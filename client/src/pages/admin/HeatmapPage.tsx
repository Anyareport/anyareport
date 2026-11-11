import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Progress,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useMutation } from '@tanstack/react-query';
import IncidentHeatmap, {
  type HeatmapMode,
  type HeatmapPoint,
} from '../../components/map/IncidentHeatmap';
import MapReportCard from '../../components/map/MapReportCard';
import '../../components/map/MapReportCard.css';
import { api, type Report } from '../../lib/api';
import type { FeatureCollection } from 'geojson';
import barangayData from '../../data/DMM.json';
import './HeatmapPage.css';

const { Text } = Typography;
const severityLevels = ['Critical', 'High', 'Medium', 'Low'] as const;
const knownSeverityLevels = new Set<string>(severityLevels);
type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';
interface RiskZone {
  purok: string;
  incidents: number;
  riskLevel: RiskLevel;
  rationale: string;
  recommendation: string;
  recommendationSource: 'ai' | 'rule';
}

interface HeatmapRiskAnalysis {
  overallSummary: string;
  riskCounts: Record<RiskLevel, number>;
  aiError: boolean;
  riskZones: RiskZone[];
}

function isPointInRing(lat: number, lng: number, ring: number[][]) {
  let inside = false;

  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [currentLng, currentLat] = ring[current];
    const [previousLng, previousLat] = ring[previous];
    const intersects =
      currentLat > lat !== previousLat > lat &&
      lng <
        ((previousLng - currentLng) * (lat - currentLat)) / (previousLat - currentLat) + currentLng;

    if (intersects) inside = !inside;
  }

  return inside;
}

function isPointInFeature(point: HeatmapPoint, feature: FeatureCollection['features'][number]) {
  const geometry = feature.geometry;
  if (geometry.type === 'Polygon') {
    return isPointInRing(point.lat, point.lng, geometry.coordinates[0] as number[][]);
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) =>
      isPointInRing(point.lat, point.lng, polygon[0] as number[][])
    );
  }

  return false;
}

function getPurokNumber(name: string) {
  return Number(name.match(/purok\s*(\d+)/i)?.[1] || Number.MAX_SAFE_INTEGER);
}

export default function AdminHeatmapPage() {
  const navigate = useNavigate();
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('dots');
  const [selectedPurok, setSelectedPurok] = useState<string>();
  const [selectedCategory, setSelectedCategory] = useState<string>();
  const [selectedSeverity, setSelectedSeverity] = useState<string>();
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [riskAnalysis, setRiskAnalysis] = useState<{
    filterKey: string;
    pointsFingerprint: string;
    data: HeatmapRiskAnalysis;
  } | null>(null);
  const [riskAnalysisErrorFor, setRiskAnalysisErrorFor] = useState<string | null>(null);

  const { data: points = [] } = useQuery({
    queryKey: ['admin-heatmap-points'],
    queryFn: () => api.get<HeatmapPoint[]>('/api/reports/heatmap'),
    refetchInterval: 30000,
  });

  const filterKey = `${selectedCategory || '*'}:${selectedSeverity || '*'}`;
  const pointsFingerprint = useMemo(
    () =>
      points
        .map(
          ({ id, lat, lng, category, severity, status }) =>
            `${id}:${lat}:${lng}:${category || ''}:${severity || ''}:${status || ''}`
        )
        .sort()
        .join('|'),
    [points]
  );
  const riskAnalysisIsOutdated = Boolean(
    riskAnalysis &&
      (riskAnalysis.filterKey !== filterKey ||
        riskAnalysis.pointsFingerprint !== pointsFingerprint)
  );
  const currentRiskAnalysis =
    riskAnalysis && !riskAnalysisIsOutdated ? riskAnalysis.data : null;

  const { data: reports = [] } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: () => api.get<Report[]>('/api/reports'),
    refetchInterval: 30000,
  });

  const riskAnalysisMutation = useMutation({
    mutationFn: (filters: { category?: string; severity?: string }) => {
      const params = new URLSearchParams();
      if (filters.category) params.set('category', filters.category);
      if (filters.severity) params.set('severity', filters.severity);
      return api.get<HeatmapRiskAnalysis>(
        `/api/reports/heatmap/risk-analysis?${params.toString()}`
      );
    },
  });

  const runRiskAnalysis = async () => {
    setRiskAnalysisErrorFor(null);
    try {
      const data = await riskAnalysisMutation.mutateAsync({
        category: selectedCategory,
        severity: selectedSeverity,
      });
      setRiskAnalysis({ filterKey, pointsFingerprint, data });
    } catch {
      setRiskAnalysisErrorFor(filterKey);
    }
  };

  const purokFeatures = useMemo(() => {
    const data = barangayData as FeatureCollection;
    return data.features
      .filter((feature) => feature.properties?.name?.toLowerCase().startsWith('purok'))
      .sort(
        (left, right) =>
          getPurokNumber(left.properties?.name || '') -
            getPurokNumber(right.properties?.name || '') ||
          (left.properties?.name || '').localeCompare(right.properties?.name || '', undefined, {
            numeric: true,
          })
      );
  }, []);

  const selectedFeature = useMemo(
    () => purokFeatures.find((feature) => feature.properties?.name === selectedPurok),
    [purokFeatures, selectedPurok]
  );

  const filteredMapPoints = useMemo(
    () =>
      points.filter(
        (point) =>
          (!selectedCategory || point.category === selectedCategory) &&
          (!selectedSeverity || point.severity === selectedSeverity)
      ),
    [points, selectedCategory, selectedSeverity]
  );

  const filteredPoints = useMemo(() => {
    return filteredMapPoints.filter((point) => {
      const matchesPurok = !selectedFeature || isPointInFeature(point, selectedFeature);
      return matchesPurok;
    });
  }, [filteredMapPoints, selectedFeature]);

  const categoryPanelPoints = useMemo(() => {
    if (!selectedFeature) return filteredMapPoints;
    return filteredMapPoints.filter((point) => isPointInFeature(point, selectedFeature));
  }, [filteredMapPoints, selectedFeature]);

  const selectedPurokPoints = useMemo(() => {
    if (!selectedFeature) return [];
    return filteredMapPoints.filter((point) => isPointInFeature(point, selectedFeature));
  }, [filteredMapPoints, selectedFeature]);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    categoryPanelPoints.forEach((point) => {
      if (point.category) map.set(point.category, (map.get(point.category) || 0) + 1);
    });
    return Array.from(map.entries()).sort((left, right) => right[1] - left[1]);
  }, [categoryPanelPoints]);

  const categoryTotal = categoryPanelPoints.length;
  const topCategory = categoryCounts[0]?.[0];

  const severityCounts = useMemo(() => {
    const counts: Array<{ severity: string; count: number }> = severityLevels.map((severity) => ({
      severity,
      count: selectedPurokPoints.filter((point) => point.severity === severity).length,
    }));
    counts.push({
      severity: 'Unspecified',
      count: selectedPurokPoints.filter(
        (point) => !point.severity || !knownSeverityLevels.has(point.severity)
      ).length,
    });
    return counts;
  }, [selectedPurokPoints]);

  useEffect(() => {
    if (selectedPointId && !filteredPoints.some((point) => point.id === selectedPointId)) {
      setSelectedPointId(null);
    }
  }, [filteredPoints, selectedPointId]);

  const purokCounts = useMemo(() => {
    return purokFeatures
      .map((feature) => {
        const name = feature.properties?.name || 'Unnamed purok';
        const count = filteredMapPoints.filter((point) => isPointInFeature(point, feature)).length;
        return [name, count] as const;
      })
      .sort(
        (left, right) =>
          right[1] - left[1] ||
          getPurokNumber(left[0]) - getPurokNumber(right[0]) ||
          left[0].localeCompare(right[0], undefined, { numeric: true })
      );
  }, [filteredMapPoints, purokFeatures]);

  const selectedReport = reports.find((report) => report._id === selectedPointId);

  const categoryOptions = useMemo(
    () => Array.from(new Set(points.map((point) => point.category).filter(Boolean))).sort(),
    [points]
  );

  const severityOptions = useMemo(
    () => severityLevels.filter((severity) => points.some((point) => point.severity === severity)),
    [points]
  );

  const mapTotal = filteredMapPoints.length;
  const selectedPurokRank = selectedPurok
    ? purokCounts.findIndex(([name]) => name === selectedPurok) + 1
    : 0;

  return (
    <div className="heatmap-page">
      <section className="heatmap-map-panel" aria-label="Incident map">
        <div className="heatmap-map-shell">
          <div className="heatmap-map-controls">
            <Select
              allowClear
              placeholder="All categories"
              value={selectedCategory}
              onChange={(value) => {
                setSelectedCategory(value);
                setSelectedPointId(null);
              }}
              options={categoryOptions.map((category) => ({
                label: category,
                value: category,
              }))}
              className="heatmap-filter"
            />
            <Select
              allowClear
              placeholder="All severity"
              value={selectedSeverity}
              onChange={(value) => {
                setSelectedSeverity(value);
                setSelectedPointId(null);
              }}
              options={severityOptions.map((severity) => ({
                label: severity,
                value: severity,
              }))}
              className="heatmap-filter heatmap-filter--severity"
            />
            <Segmented
              value={heatmapMode}
              onChange={(value) => {
                setHeatmapMode(value as HeatmapMode);
                setSelectedPointId(null);
              }}
              options={[
                { label: 'Dots', value: 'dots' },
                { label: 'Gradient', value: 'gradient' },
                { label: 'Choropleth', value: 'choropleth' },
              ]}
            />
            {(selectedCategory || selectedSeverity) && (
              <Button
                type="link"
                onClick={() => {
                  setSelectedCategory(undefined);
                  setSelectedSeverity(undefined);
                  setSelectedPointId(null);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
          <IncidentHeatmap
            points={filteredPoints}
            height="100%"
            mode={heatmapMode}
            onPointClick={(point) => setSelectedPointId(point.id)}
            selectedPointId={selectedPointId}
            renderPointPopup={(point) => {
              if (!selectedReport || selectedReport._id !== point.id) return null;
              return (
                <MapReportCard
                  report={selectedReport}
                  showPhoto={false}
                  onViewDetails={() => navigate(`/admin/incidents/${selectedReport._id}`)}
                  onDismiss={() => setSelectedPointId(null)}
                />
              );
            }}
            purokCounts={new Map(purokCounts)}
            selectedPurok={selectedPurok}
            onPurokClick={(name) => {
              setSelectedPurok(selectedPurok === name ? undefined : name);
              setSelectedPointId(null);
            }}
          />
          <div className="heatmap-map-summary">
            <Text className="heatmap-map-summary__eyebrow">
              {selectedPurok ? `${selectedPurok} selected` : 'All mapped incidents'}
            </Text>
            <strong>{selectedPurok ? selectedPurokPoints.length : mapTotal}</strong>
            <span>reports in current view</span>
          </div>
          <div className="heatmap-legend" aria-label="Map legend">
            {heatmapMode === 'choropleth' ? (
              <>
                <span>Low</span>
                <i className="heatmap-legend__ramp" aria-hidden="true" />
                <span>High</span>
              </>
            ) : (
              severityLevels.map((severity) => (
                <span key={severity} className="heatmap-legend__item">
                  <i
                    className={`heatmap-legend__dot heatmap-legend__dot--${severity.toLowerCase()}`}
                    aria-hidden="true"
                  />
                  {severity}
                </span>
              ))
            )}
          </div>
        </div>
      </section>
      <aside className="heatmap-analytics" aria-label="Heatmap analytics">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card className="soft-card heatmap-ai-card" title="AI risk analysis">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Text type="secondary">
                Risk levels use incident counts and severity. Suggested actions are based on the
                current category and severity filters.
              </Text>
              <Button
                type="primary"
                block
                disabled={mapTotal === 0}
                loading={riskAnalysisMutation.isPending}
                onClick={() => void runRiskAnalysis()}
              >
                {riskAnalysis ? 'Re-analyze' : 'Analyze risk zones'}
              </Button>
              {riskAnalysisMutation.isPending && (
                <Text type="secondary">Analyzing risk zones...</Text>
              )}
              {riskAnalysisIsOutdated && (
                <Alert
                  type="info"
                  showIcon
                  message="Heatmap data or filters changed"
                  description="The previous analysis is hidden so the risk labels stay aligned with the current map. Re-analyze to update it."
                />
              )}
              {riskAnalysisErrorFor === filterKey && (
                <Alert
                  type="error"
                  showIcon
                  message="Couldn’t get the analysis"
                  description="Your rankings and map are still available. Try again in a moment."
                  action={
                    <Button size="small" onClick={() => void runRiskAnalysis()}>
                      Retry
                    </Button>
                  }
                />
              )}
              {currentRiskAnalysis?.aiError && (
                <Alert
                  type="warning"
                  showIcon
                  message="AI suggestions are unavailable"
                  description="Risk levels and standard guidance are still available. Try again later for tailored suggestions."
                />
              )}
              {currentRiskAnalysis && (
                <>
                  <Space size={[4, 4]} wrap aria-label="Areas by risk level">
                    {severityLevels.map((level) => (
                      <Tag
                        key={level}
                        className={`heatmap-ai-risk-tag heatmap-ai-risk-tag--${level.toLowerCase()}`}
                      >
                        {currentRiskAnalysis.riskCounts[level]} {level}
                      </Tag>
                    ))}
                  </Space>
                  <Text>{currentRiskAnalysis.overallSummary}</Text>
                  {currentRiskAnalysis.riskZones.length === 0 ? (
                    <Text type="secondary">No mapped incidents match the current filters.</Text>
                  ) : (
                    <div className="heatmap-ai-zone-list">
                      {currentRiskAnalysis.riskZones.slice(0, 3).map((zone) => (
                        <article key={zone.purok} className="heatmap-ai-zone">
                          <div className="heatmap-ai-zone__heading">
                            <Text strong>{zone.purok}</Text>
                            <Tag
                              className={`heatmap-ai-risk-tag heatmap-ai-risk-tag--${zone.riskLevel.toLowerCase()}`}
                            >
                              {zone.riskLevel}
                            </Tag>
                          </div>
                          <Text className="heatmap-ai-zone__evidence">{zone.rationale}</Text>
                          <Text className="heatmap-ai-zone__label">
                            {zone.recommendationSource === 'ai' ? 'AI suggested action' : 'Standard guidance'}
                          </Text>
                          <Text>{zone.recommendation}</Text>
                        </article>
                      ))}
                    </div>
                  )}
                  <Text type="secondary" className="heatmap-ai-disclaimer">
                    Advisory only. Verify with current conditions and official assessments before
                    acting.
                  </Text>
                </>
              )}
              {riskAnalysisErrorFor !== filterKey && mapTotal === 0 && (
                <Text type="secondary">No mapped incidents match the current filters.</Text>
              )}
            </Space>
          </Card>
          <Card
            className="soft-card heatmap-list-card"
            title="Purok Incidents"
            extra={
              <Button
                variant="outlined"
                color="primary"
                onClick={() => navigate('/admin/analytics')}
              >
                View Analytics
              </Button>
            }
          >
            <div className="heatmap-list-meta">
              <Text type="secondary">Ranked by current filtered reports</Text>
              <Text strong>{mapTotal} total</Text>
            </div>
            <div className="heatmap-purok-list">
              {purokCounts.map(([name, count]) => {
                const riskZone = currentRiskAnalysis?.riskZones.find((zone) => zone.purok === name);
                return (
                  <Fragment key={name}>
                    <Button
                      type="text"
                      block
                      className={`heatmap-purok-row${selectedPurok === name ? ' is-selected' : ''}`}
                      aria-pressed={selectedPurok === name}
                      onClick={() => {
                        setSelectedPurok(selectedPurok === name ? undefined : name);
                        setSelectedPointId(null);
                      }}
                    >
                      <span className="heatmap-purok-row__name">{name}</span>
                      {riskZone && (
                        <Tag
                          className={`heatmap-ai-risk-tag heatmap-ai-risk-tag--${riskZone.riskLevel.toLowerCase()}`}
                        >
                          {riskZone.riskLevel}
                        </Tag>
                      )}
                      <span className="heatmap-purok-row__count">{count}</span>
                      <span className="heatmap-purok-row__track" aria-hidden="true">
                        <span
                          style={{
                            width: `${purokCounts[0]?.[1] ? (count / purokCounts[0][1]) * 100 : 0}%`,
                          }}
                        />
                      </span>
                    </Button>
                    {selectedPurok === name && riskZone && (
                      <div className="heatmap-ai-selected-zone">
                        <Text className="heatmap-ai-zone__label">Why this area is listed</Text>
                        <Text className="heatmap-ai-zone__evidence">{riskZone.rationale}</Text>
                        <Text className="heatmap-ai-zone__label">
                          {riskZone.recommendationSource === 'ai'
                            ? 'AI suggested action'
                            : 'Standard guidance'}
                        </Text>
                        <Text>{riskZone.recommendation}</Text>
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          </Card>

          {selectedPurok && (
            <Card className="soft-card heatmap-summary-card" title={`${selectedPurok} summary`}>
              <div className="heatmap-summary-stat">
                <strong>{selectedPurokPoints.length}</strong>
                <span>reports</span>
                <Text type="secondary">Ranked #{selectedPurokRank}</Text>
              </div>
              <div className="heatmap-summary-detail">
                <Text>Top category</Text>
                <strong>{topCategory || 'None'}</strong>
              </div>
              <div className="heatmap-severity-grid">
                {severityCounts.map(({ severity, count }) => (
                  <div key={severity}>
                    <span>{severity}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
              {(selectedCategory || selectedSeverity) && (
                <Text type="secondary" className="heatmap-filter-note">
                  Results reflect the active filters.
                </Text>
              )}
            </Card>
          )}

          <Card className="soft-card heatmap-category-card" title="Category Concentration">
            <div className="heatmap-category-list">
              {categoryCounts.map(([category, count]) => (
                <div className="heatmap-category-row" key={category}>
                  <div className="heatmap-category-row__topline">
                    <Text strong>{category}</Text>
                    <Text type="secondary">{count}</Text>
                  </div>
                  <Progress
                    percent={categoryTotal ? Math.round((count / categoryTotal) * 100) : 0}
                    showInfo={false}
                    strokeColor="var(--brand-primary)"
                    size="small"
                  />
                </div>
              ))}
              {categoryCounts.length === 0 && (
                <Text type="secondary">No incidents match the current filters.</Text>
              )}
            </div>
          </Card>
        </Space>
      </aside>
    </div>
  );
}

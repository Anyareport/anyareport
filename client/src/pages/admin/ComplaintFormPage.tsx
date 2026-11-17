import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  List,
  Row,
  Space,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  EyeOutlined,
  PlusOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { api, type ComplaintFormSummary, type Report } from '../../lib/api';
import { useAntdMessage } from '../../lib/useAntdMessage';
import './ComplaintFormPage.css';
import {
  blankComplaintValues,
  buildComplaintFilename,
  canvasToJpegBlob,
  complaintDateParts,
  downloadBlob,
  noComplaintOverflow,
  printComplaintCanvas,
  renderComplaintCanvas,
  type ComplaintFormValues,
  type ComplaintOverflow,
} from '../../lib/complaintForm';

const { Text } = Typography;

function reportToComplaintValues(report: Report): ComplaintFormValues {
  const complainant = report.reportedBy || report.submitterName || '';
  const details = [report.description, report.location?.address && `Location: ${report.location.address}`]
    .filter(Boolean)
    .join(' ');

  return {
    ...blankComplaintValues(),
    caseNo: report.referenceNumber || '',
    complainantName: complainant,
    contactNumber: report.reportedByContact || report.submitterPhone || '',
    caseFor: [report.category, report.subcategory].filter(Boolean).join(' - '),
    narrative: details,
  };
}

// The form edits whole dates; the canvas still prints each as day / month / 2-digit year.
type ComplaintFormFields = ComplaintFormValues & { madeDate: Dayjs; receivedDate: Dayjs };

export default function ComplaintFormPage() {
  const message = useAntdMessage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reportId = searchParams.get('report');
  const manual = searchParams.get('manual') === '1';
  const manualId = searchParams.get('manualId');
  const viewSaved = searchParams.get('view') === 'saved';
  const canEditForm = !manualId && !viewSaved;
  const [search, setSearch] = useState('');
  const [form] = Form.useForm<ComplaintFormFields>();
  const [initialValues] = useState<ComplaintFormFields>(() => ({
    ...blankComplaintValues(),
    madeDate: dayjs(),
    receivedDate: dayjs(),
  }));
  const [values, setValues] = useState<ComplaintFormValues>(() => blankComplaintValues());
  const [previewUrl, setPreviewUrl] = useState('');
  const [savedImage, setSavedImage] = useState<string | null>(null);
  const [overflow, setOverflow] = useState<ComplaintOverflow>(noComplaintOverflow);
  const [busy, setBusy] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const { data: report } = useQuery({
    queryKey: ['complaint-prefill', reportId],
    queryFn: () => api.get<Report>(`/api/reports/${reportId}`),
    enabled: Boolean(reportId),
  });
  const { data: complaintFormsResponse, isLoading: complaintFormsLoading } = useQuery({
    queryKey: ['complaint-forms', search],
    queryFn: () =>
      api.get<ComplaintFormSummary[]>(
        `/api/reports/complaint-forms?search=${encodeURIComponent(search)}`
      ),
    enabled: !reportId,
  });
  const { data: manualFormsResponse } = useQuery({
    queryKey: ['manual-complaint-forms', search],
    queryFn: () =>
      api.get<ComplaintFormSummary[]>(
        `/api/complaint-forms?search=${encodeURIComponent(search)}`
      ),
    enabled: !reportId && !manual,
  });
  const complaintForms = Array.isArray(complaintFormsResponse) ? complaintFormsResponse : [];
  const manualForms = Array.isArray(manualFormsResponse) ? manualFormsResponse : [];
  const { data: manualForm } = useQuery({
    queryKey: ['manual-complaint-form', manualId],
    queryFn: () =>
      api.get<ComplaintFormValues & { image: string }>(
        `/api/complaint-forms/${manualId}`
      ),
    enabled: Boolean(manualId),
  });

  const applyValues = (next: ComplaintFormValues, madeDate = dayjs(), receivedDate = dayjs()) => {
    form.setFieldsValue({ ...next, madeDate, receivedDate });
    setValues(next);
  };

  useEffect(() => {
    if (!manual || manualId || reportId) return;

    const blankValues = blankComplaintValues();
    const madeDate = dayjs();
    const receivedDate = dayjs();
    form.resetFields();
    form.setFieldsValue({ ...blankValues, madeDate, receivedDate });
    setValues(blankValues);
    setSavedImage(null);
    setPreviewUrl('');
    setOverflow(noComplaintOverflow);
  }, [form, manual, manualId, reportId]);

  // Prefill once the linked incident loads (secretary can still edit everything).
  useEffect(() => {
    if (!report) return;
    setSavedImage(report.complaintForm?.image || null);
    if (report.complaintForm) {
      const { image: _savedImage, ...savedComplaintValues } = report.complaintForm;
      const saved = { ...blankComplaintValues(), ...savedComplaintValues };
      applyValues(
        saved,
        dayjs(`${saved.madeMonth} ${saved.madeDay}, 20${saved.madeYear}`),
        dayjs(`${saved.receivedMonth} ${saved.receivedDay}, 20${saved.receivedYear}`)
      );

    } else {
      applyValues(reportToComplaintValues(report));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);
  useEffect(() => {
    if (!manualForm) return;
    setSavedImage(manualForm.image);
    const { image: _image, ...formValues } = manualForm;
    applyValues({ ...blankComplaintValues(), ...formValues });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualForm]);

  // Live preview, debounced so typing stays smooth.
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { canvas, overflow: nextOverflow } = await renderComplaintCanvas(values);
        if (cancelled) return;
        setOverflow(nextOverflow);
        setPreviewUrl(canvas.toDataURL('image/jpeg', 0.7));
      } catch (error) {
        if (!cancelled) message.error(error instanceof Error ? error.message : 'Preview failed.');
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [values, message]);

  const hasOverflow = Object.values(overflow).some(Boolean);
  const missingFields = Object.entries(values)
    .filter(([, value]) => !value.trim())
    .map(([field]) => field);
  const isMissing = (field: keyof ComplaintFormValues) =>
    showValidation && missingFields.includes(field);
  const missingDate = (prefix: 'made' | 'received') =>
    ['Day', 'Month', 'Year'].some((part) =>
      isMissing(`${prefix}${part}` as keyof ComplaintFormValues)
    );

  const validateBeforeExport = () => {
    setShowValidation(true);
    if (!missingFields.length) return true;
    message.error('Complete all complaint form fields before printing or downloading.');
    return false;
  };

  const saveManualForm = async (canvas: HTMLCanvasElement) => {
    const payload = { ...values, image: canvas.toDataURL('image/jpeg', 0.92) };
    if (manualId) {
      await api.patch(`/api/complaint-forms/${manualId}`, payload);
    } else {
      const saved = await api.post<{ _id: string }>('/api/complaint-forms', payload);
      navigate(`/admin/complaint?manualId=${saved._id}`);
    }
  };

  const saveIncidentForm = async (canvas: HTMLCanvasElement) => {
    if (!reportId) return;
    await api.patch(`/api/reports/${reportId}/complaint-form`, {
      ...values,
      image: canvas.toDataURL('image/jpeg', 0.92),
    });
  };

  // Renders the full-quality canvas and hands it to `action`, with shared busy/error handling.
  const exportForm = async (
    action: (canvas: HTMLCanvasElement) => void | Promise<void>,
    errorText: string
  ) => {
    setBusy(true);
    try {
      const { canvas } = await renderComplaintCanvas(values);
      await action(canvas);
    } catch (error) {
      message.error(error instanceof Error ? error.message : errorText);
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = () =>
    validateBeforeExport() &&
    exportForm(
      async (canvas) => {
        if (manual) await saveManualForm(canvas);
        if (reportId && !viewSaved) await saveIncidentForm(canvas);
        printComplaintCanvas(canvas);
        if (reportId) {
          await api.post(`/api/reports/${reportId}/complaint-form-export`, { action: 'print' });
        }
      },
      'Could not print the form.'
    );

  const handleDownload = () =>
    validateBeforeExport() &&
    exportForm(
      async (canvas) => {
        if (manual) await saveManualForm(canvas);
        if (reportId && !viewSaved) await saveIncidentForm(canvas);
        await downloadBlob(await canvasToJpegBlob(canvas), buildComplaintFilename(values));
        if (reportId) {
          await api.post(`/api/reports/${reportId}/complaint-form-export`, { action: 'download' });
        }
      },
      'Could not create the JPEG.'
    );

  const textField = (name: keyof ComplaintFormValues, label: string) => (
    <Form.Item
      name={name}
      label={label}
      validateStatus={isMissing(name) ? 'error' : undefined}
      help={isMissing(name) ? 'This field is required.' : undefined}
      required
    >
      <Input disabled={!canEditForm} status={isMissing(name) ? 'error' : undefined} />
    </Form.Item>
  );

  // Fields whose text wraps onto several printed lines; `lines` is how many fit.
  const wrappedField = (
    name: keyof ComplaintOverflow,
    label: string,
    lines: number,
    multiline = true
  ) => (
    <Form.Item
      name={name}
      label={label}
      validateStatus={isMissing(name) ? 'error' : overflow[name] ? 'warning' : undefined}
      help={
        isMissing(name)
          ? 'This field is required.'
          : overflow[name]
            ? `Too long: only the first ${lines} lines fit on the form.`
            : undefined
      }
      required
    >
      {multiline ? (
        <Input.TextArea
          rows={lines}
          disabled={!canEditForm}
          status={isMissing(name) ? 'error' : undefined}
        />
      ) : (
        <Input disabled={!canEditForm} status={isMissing(name) ? 'error' : undefined} />
      )}
    </Form.Item>
  );

  return (
    <div className="complaint-form-page">
      <div className="complaint-form-page__header">
         
        {!reportId && !manual && !manualId ? (
          <>
            <Input.Search
              allowClear
              placeholder="Search by reference number, complainant, or case type"
              onSearch={setSearch}
              onChange={(event) => {
                if (!event.target.value) setSearch('');
              }}
              className="complaint-form-page__search"
            />

            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/admin/complaint?manual=1')}>
              Add complaint form
            </Button>
          </>
        ) : null}
      </div>
      
      {!reportId && !manual && !manualId ? (
        <Card className="soft-card complaint-form-page__list-card">
          
         
          <List
            loading={complaintFormsLoading}
            dataSource={[...complaintForms, ...manualForms]}
            locale={{ emptyText: <Empty description="No saved complaint forms found" /> }}
            renderItem={(item) => (
              <List.Item className="complaint-form-page__list-item"
                actions={[
                  <Button
                    key="view"
                    icon={<EyeOutlined />}
                    onClick={() =>
                      navigate(
                        item.source === 'manual'
                          ? `/admin/complaint?manualId=${item._id}&view=saved`
                          : `/admin/complaint?report=${item._id}&view=saved`
                      )
                    }
                  >
                    View form
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={item.referenceNumber || 'No reference number'}
                  description={[
                    item.complainantName,
                    [item.category, item.subcategory].filter(Boolean).join(' - '),
                    `Updated ${new Date(item.updatedAt).toLocaleString()}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              </List.Item>
            )}
          />
        </Card>
      ) : viewSaved && savedImage ? (
        <Card className="soft-card complaint-form-page__saved-card">
          <div className="complaint-form-page__saved-toolbar">
            
            <Space wrap>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
                Go back
              </Button>
              <Button type="primary" icon={<PrinterOutlined />} loading={busy} onClick={handlePrint}>
                Print
              </Button>
              <Button icon={<DownloadOutlined />} loading={busy} onClick={handleDownload}>
                Download JPEG
              </Button>
            </Space>
          </div>
          <img
            src={savedImage}
            alt="Saved complaint form"
            className="complaint-form-page__saved-image"
          />
        </Card>
      ) : (
        <div className="complaint-form-page__editor">
          <div className="complaint-form-page__editor-heading">
            
            {reportId ? (
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Go back</Button>
            ) : null}
          </div>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={11}>
              <Card className="soft-card complaint-form-page__details-card" title="Form details">
                
                <Form
                  form={form}
                  layout="vertical"
                  disabled={!canEditForm}
                  initialValues={initialValues}
                  onValuesChange={(_, { madeDate, receivedDate, ...rest }) =>
                    setValues((prev) => ({
                      ...prev,
                      ...rest,
                      ...(madeDate && complaintDateParts('made', madeDate.toDate())),
                      ...(receivedDate && complaintDateParts('received', receivedDate.toDate())),
                    }))
                  }
                >
                  {textField('caseNo', 'Barangay Case No.')}
                  {wrappedField('caseFor', 'For (continues on the second line)', 2, false)}
                  {wrappedField(
                    'complainantName',
                    'Complainant name (continues on the second line)',
                    2,
                    false
                  )}
                  {textField('contactNumber', 'Contact #')}
                  {wrappedField('respondentName', 'Respondent name (continues on the second line)', 2, false)}
                  {wrappedField('narrative', 'Complaint (manner of violation)', 5)}
                  {wrappedField('relief', 'Relief requested', 4)}
                  <Form.Item
                    name="madeDate"
                    label="Date made"
                    validateStatus={missingDate('made') ? 'error' : undefined}
                    help={missingDate('made') ? 'This field is required.' : undefined}
                    required
                  >
                    <DatePicker
                      format="MMMM D, YYYY"
                      allowClear={false}
                      status={missingDate('made') ? 'error' : undefined}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item
                    name="receivedDate"
                    label="Date received and filed"
                    validateStatus={missingDate('received') ? 'error' : undefined}
                    help={missingDate('received') ? 'This field is required.' : undefined}
                    required
                  >
                    <DatePicker
                      format="MMMM D, YYYY"
                      allowClear={false}
                      status={missingDate('received') ? 'error' : undefined}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Form>
              </Card>
            </Col>
            <Col xs={24} lg={13}>
              <Card className="soft-card complaint-form-page__preview-card" title="Preview">
                {hasOverflow ? (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="Some text is too long for the form and will be cut off."
                  />
                ) : null}
                <Space className="complaint-form-page__export-actions" wrap>
                  <Button type="primary" icon={<PrinterOutlined />} loading={busy} onClick={handlePrint}>
                    Print
                  </Button>
                  <Button icon={<DownloadOutlined />} loading={busy} onClick={handleDownload}>
                    Download JPEG
                  </Button>
                </Space>
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Filled complaint form preview"
                    style={{ width: '100%', height: 'auto', border: '1px solid #d9d9d9' }}
                  />
                ) : (
                  <Text type="secondary">Loading preview...</Text>
                )}
              </Card>
            </Col>
          </Row>
        </div>
      )}
    </div>
  );
}
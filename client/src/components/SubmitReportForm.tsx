import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Form,
  Select,
  Input,
  Button,
  Checkbox,
  Upload,
  Typography,
  Alert,
  Steps,
  Segmented,
  Radio,
  Descriptions,
  Image,
  Spin,
  Space,
} from 'antd';
import {
  UploadOutlined,
  EnvironmentOutlined,
  CameraOutlined,
  FileTextOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, type Category } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { FeatureCollection } from 'geojson';
import { findContainingPurok, isInsideBarangayBoundary } from '../components/map/MapPicker';
import SeverityTag from './SeverityTag';
import AppTag from './AppTag';
import barangayData from '../data/DMM.json';
import { compressImage, MAX_COMPRESSED_IMAGE_SIZE_BYTES } from '../lib/imageCompressor';
import { useAntdMessage } from '../lib/useAntdMessage';
import { getCaptchaToken } from '../lib/captcha';
import { rememberGuestReport } from '../lib/guestReports';

const { Title, Text } = Typography;

type ReportType = 'text' | 'photo';
type Severity = 'Low' | 'Medium' | 'High' | 'Critical';

const SEVERITY_OPTIONS: Severity[] = ['Low', 'Medium', 'High', 'Critical'];

const SUBCATEGORY_MAP: Record<string, string[]> = {
  'Public Concerns': ['Sanitation', 'Infrastructure'],
  'Blotter Cases': ['Civil', 'Criminal'],
  'Emergency Situations': ['Public', 'Private'],
};

const barangaySuffix = 'Don Mariano Marcos';
const barangaySuffixPattern = /,?\s*Don Mariano Marcos\s*$/i;

interface SubmitReportFormProps {
  guest?: boolean;
  onGuestDone?: () => void;
  successPath?: string;
  selectedLocation: [number, number] | null;
  selectedLocationMethod: 'map' | 'gps' | null;
  onPickLocation: () => void;
  onLocationChange: (position: [number, number], method: 'map' | 'gps') => void;
}

interface ClassificationResult {
  category: string;
  subcategory: string;
  severity: Severity;
}

interface ReportFormValues {
  reportType: ReportType;
  description?: string;
  address?: string;
  category: string;
  subcategory: string;
  severity: Severity;
}

export default function SubmitReportForm({
  guest = false,
  onGuestDone,
  successPath = '/resident/reports',
  selectedLocation,
  selectedLocationMethod,
  onPickLocation,
  onLocationChange,
}: SubmitReportFormProps) {
  const message = useAntdMessage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [form] = Form.useForm<ReportFormValues>();

  const [currentStep, setCurrentStep] = useState(0);
  const [maxStepReached, setMaxStepReached] = useState(0);
  const [aiProcessingAcknowledged, setAiProcessingAcknowledged] = useState(false);

  const [reportType, setReportType] = useState<ReportType>('text');
  const [fileList, setFileList] = useState<
    { originFileObj: File; thumbUrl?: string; compressedBlob?: Blob }[]
  >([]);
  const [photoPreparationErrors, setPhotoPreparationErrors] = useState<File[]>([]);
  const [isPreparingPhotos, setIsPreparingPhotos] = useState(false);

  const [classification, setClassification] = useState<ClassificationResult>();
  const [manuallyEdited, setManuallyEdited] = useState(false);

  // Ref to track if classification is in progress
  const classificationInProgressRef = useRef(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/api/reports/categories'),
  });

  useEffect(() => {
    if (!selectedLocation) return;

    const address = findContainingPurok(selectedLocation, barangayData as FeatureCollection);
    if (address) form.setFieldValue('address', address);
  }, [form, selectedLocation]);

  const resetClassificationState = useCallback(() => {
    setClassification(undefined);
    setManuallyEdited(false);
    form.setFieldsValue({ category: undefined, subcategory: undefined, severity: undefined });
  }, [form]);

  // Process multiple files for upload (max 3)
  const handleFileChange = async (files: File[]) => {
    if (files.length > 3) {
      message.error('You can attach up to 3 photos per report.');
      files = files.slice(0, 3);
    }

    const processedFiles = [];
    const failedFiles = [];
    setIsPreparingPhotos(true);
    for (const file of files) {
      try {
        const compressedBlob = await compressImage(file);

        const compressedFile = new File([compressedBlob], 'compressed.jpg', { type: 'image/jpeg' });
        const thumbUrl = URL.createObjectURL(compressedFile);

        const originalSize = file.size;
        const compressedSize = compressedBlob.size;
        const reduction = (((originalSize - compressedSize) / originalSize) * 100).toFixed(1);
        console.log(
          `Original: ${originalSize} bytes, Compressed: ${compressedSize} bytes (${reduction}% reduction)`
        );

        processedFiles.push({ originFileObj: file, thumbUrl, compressedBlob });
      } catch (err) {
        console.error('Image compression failed for', file.name, err);
        failedFiles.push(file);
      }
    }

    setFileList(processedFiles);
    setPhotoPreparationErrors(failedFiles);
    setIsPreparingPhotos(false);
    if (failedFiles.length > 0) {
      message.warning('Some photos could not be prepared. Remove or replace them before continuing.');
    }
    resetClassificationState();
  };

  const classifyMutation = useMutation({
    mutationFn: async () => {
      const values = form.getFieldsValue();
      const description = values.description || '';

      const formData = new FormData();
      formData.append('description', description);

      // Send all compressed photos (up to 3)
      fileList.forEach((f) => {
        if (f.compressedBlob) {
          formData.append('photos', f.compressedBlob, 'compressed.jpg');
        } else if (f.originFileObj) {
          formData.append('photos', f.originFileObj);
        }
      });

      return api.post<ClassificationResult>(
        guest ? '/api/reports/guest/classify' : '/api/reports/classify',
        formData
      );
    },
    onSuccess: (result) => {
      setClassification(result);
      if (!manuallyEdited) {
        form.setFieldsValue({
          category: result.category,
          subcategory: result.subcategory,
          severity: result.severity,
        });
      }
      classificationInProgressRef.current = false;
    },
    onError: () => {
      message.warning("We couldn't suggest a category. Please choose one manually.");
      classificationInProgressRef.current = false;
    },
  });
  const clientRequestIdRef = useRef<string>(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  );

  const submitMutation = useMutation({
    retry: (failureCount, error) => error instanceof TypeError && failureCount < 2,
    retryDelay: 1500,
    mutationFn: async (values: ReportFormValues) => {
      if (isPreparingPhotos || photoPreparationErrors.length > 0) {
        throw new Error('Please finish preparing or remove the photos that could not be compressed.');
      }
      if (!selectedLocation) {
        throw new Error('Please select a location before submitting.');
      }

      const formData = new FormData();
      formData.append('clientRequestId', clientRequestIdRef.current);
      formData.append('category', values.category);
      formData.append('subcategory', values.subcategory);
      formData.append('severity', values.severity);
      formData.append('description', values.description || '');
      formData.append('address', values.address || '');
      formData.append('latitude', String(selectedLocation[0]));
      formData.append('longitude', String(selectedLocation[1]));
      
      fileList.forEach((f) => {
        if (f.compressedBlob) formData.append('photos', f.compressedBlob, 'photo.jpg');
        else formData.append('photos', f.originFileObj);
      });
      if (guest) {
        const captchaToken = await getCaptchaToken('guest_report');
        if (captchaToken) formData.append('captchaToken', captchaToken);
      }
      return api.post(guest ? '/api/reports/guest' : '/api/reports', formData);
    },
    onSuccess: (result) => {
      if (guest) {
        rememberGuestReport(clientRequestIdRef.current);
        const receipt = result as { referenceNumber?: string };
        message.success(
          receipt.referenceNumber
            ? `Report submitted successfully. Reference: ${receipt.referenceNumber}`
            : 'Report submitted successfully!'
        );
        onGuestDone?.();
        return;
      }
      message.success('Report submitted successfully!');
      queryClient.invalidateQueries({ queryKey: ['my-reports'] });
      navigate(successPath);
    },
    onError: (err: Error) => message.error(err.message),
  });

  // Runs classification if (and only if) it's missing and not already
  // in flight. Returns a promise so callers can await it before navigating.
  const ensureClassified = useCallback(async () => {
    if (classification || classificationInProgressRef.current) return;
    classificationInProgressRef.current = true;
    try {
      await classifyMutation.mutateAsync();
    } catch {
      // onError already surfaces a message; swallow here so callers can
      // still navigate forward and let the user fill fields manually.
    }
  }, [classification, classifyMutation]);

  const goNext = useCallback(async () => {
    try {
      if (currentStep === 0) {
        if (!aiProcessingAcknowledged) {
          message.warning('Please review the AI-processing notice and check the box to continue.');
          return;
        }

        const fieldsToCheck = reportType === 'text' ? ['description'] : [];
        await form.validateFields(fieldsToCheck);

        if (isPreparingPhotos) {
          message.warning('Please wait while your photos are prepared.');
          return;
        }
        if (photoPreparationErrors.length > 0) {
          message.error('Remove or replace photos that could not be prepared before continuing.');
          return;
        }

        // Validate max 3 photos
        if (reportType === 'photo' && fileList.length > 3) {
          message.error('You can attach up to 3 photos per report.');
          return;
        }

        if (!selectedLocation) {
          message.error('Please select a location on the map or use GPS.');
          return;
        }
        void ensureClassified();
      }

      if (currentStep === 1) {
        await form.validateFields(['category', 'subcategory', 'severity']);
      }

      const next = currentStep + 1;
      setCurrentStep(next);
      setMaxStepReached((m) => Math.max(m, next));
    } catch {
      // Form validation displays the relevant field errors.
    }
  }, [
    currentStep,
    reportType,
    selectedLocation,
    ensureClassified,
    form,
    fileList,
    aiProcessingAcknowledged,
    message,
    isPreparingPhotos,
    photoPreparationErrors.length,
  ]);

  const goBack = () => setCurrentStep((s) => Math.max(0, s - 1));

  // Handles clicks on the Steps header. Going backward is always safe.
  // Going forward must re-run the same guard/classify logic as "Next" so
  // a stale (or missing) classification can never be skipped by jumping
  // straight to Review.
  const handleStepClick = useCallback(
    async (step: number) => {
      if (step <= currentStep) {
        setCurrentStep(step);
        return;
      }
      if (step > maxStepReached) return;

      if (step >= 1) {
        if (isPreparingPhotos) {
          message.warning('Please wait while your photos are prepared.');
          return;
        }
        if (photoPreparationErrors.length > 0) {
          message.error('Remove or replace photos that could not be prepared before continuing.');
          return;
        }
        if (!aiProcessingAcknowledged) {
          message.warning('Please review the AI-processing notice and check the box to continue.');
          return;
        }
        if (!selectedLocation) {
          message.error('Please select a location on the map or use GPS.');
          return;
        }
        await ensureClassified();
      }

      if (step >= 2) {
        await form.validateFields(['category', 'subcategory', 'severity']);
      }

      setCurrentStep(step);
    },
    [
      currentStep,
      maxStepReached,
      selectedLocation,
      ensureClassified,
      form,
      aiProcessingAcknowledged,
      message,
      isPreparingPhotos,
      photoPreparationErrors.length,
    ]
  );

  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      message.error('GPS is not available on this device.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        const isInside = isInsideBarangayBoundary(point, barangayData as FeatureCollection);

        if (!isInside) {
          message.error('Your current location is outside the barangay boundary.');
          return;
        }

        onLocationChange(point, 'gps');
        message.success('Location detected via GPS.');
      },
      () => message.error('Could not get your location. Please tap the map instead.')
    );
  };

  const selectedCategory = Form.useWatch('category', form);

  if (!guest && !profile?.emailVerified) {
    return (
      <Alert
        type="warning"
        message="Email verification required"
        description="Please verify your email before submitting reports. Check your inbox for the verification link."
        showIcon
      />
    );
  }
  const STEP_LABELS = ['Incident details', 'Classification', 'Review'];

  return (
    <div>
      <Steps
        current={currentStep}
        size="small"
        responsive={false}
        onChange={handleStepClick}
        style={{ marginBottom: 32, cursor: 'pointer' }}
        items={[{}, {}, {}]}
      />

      <Title
        level={4}
        style={{
          marginTop: 8,
        }}
      >
        {STEP_LABELS[currentStep]}
      </Title>
      {/* STEP 1: Incident details and location */}
      <Form form={form} layout="vertical" initialValues={{ reportType: 'text' }}>
        <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>
          <Form.Item>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {selectedLocation ? (
                <AppTag tone="info">Location selected</AppTag>
              ) : (
                <AppTag tone="danger">No location selected</AppTag>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 8,
                  width: '100%',
                }}
              >
                <Button
                  aria-pressed={selectedLocationMethod === 'map'}
                  style={
                    selectedLocationMethod === 'map'
                      ? { outline: '2px solid var(--brand-primary)', outlineOffset: 1 }
                      : undefined
                  }
                  icon={<EnvironmentOutlined />}
                  onClick={onPickLocation}
                >
                  Pick on map
                </Button>
                <Button
                  aria-pressed={selectedLocationMethod === 'gps'}
                  style={
                    selectedLocationMethod === 'gps'
                      ? { outline: '2px solid var(--brand-primary)', outlineOffset: 1 }
                      : undefined
                  }
                  icon={<SendOutlined />}
                  onClick={handleUseGPS}
                >
                  Use my location
                </Button>
              </div>
            </Space>
          </Form.Item>
          <Form.Item label="How would you like to report this?">
            <Segmented
              block
              value={reportType}
              onChange={(val) => setReportType(val as ReportType)}
              options={[
                {
                  label: 'Text description',
                  value: 'text',
                  icon: <FileTextOutlined />,
                },
                {
                  label: 'Take a photo',
                  value: 'photo',
                  icon: <CameraOutlined />,
                },
              ]}
            />
          </Form.Item>

          {reportType === 'photo' && (
            <Form.Item label="Photo (max 3)">
              <Upload
                listType="picture-card"
                beforeUpload={() => false} // Disable default upload
                disabled={isPreparingPhotos}
                maxCount={3}
                accept="image/*"
                capture="environment"
                fileList={fileList as any}
                onChange={(info) => {
                  const files = info.fileList.map((f) => f.originFileObj as File);
                  handleFileChange(files);
                }}
                onRemove={(targetFile) => {
                  const idx = fileList.findIndex(
                    (f) => f.originFileObj === (targetFile.originFileObj as unknown as File)
                  );
                  const newFileList =
                    idx >= 0
                      ? fileList.filter((_, i) => i !== idx)
                      : fileList.filter((f) => f.originFileObj.name !== targetFile.name);
                  setFileList(newFileList);
                  // Photo set changed — clear the now-stale classification.
                  resetClassificationState();
                }}
              >
                {fileList.length < 3 && (
                  <div>
                    <UploadOutlined />
                    <div style={{ marginTop: 8 }}>Upload</div>
                  </div>
                )}
              </Upload>
              {isPreparingPhotos && <Spin size="small" tip="Preparing photos..." />}
            </Form.Item>
          )}
          {photoPreparationErrors.length > 0 && (
            <Alert
              type="error"
              showIcon
              message="Some photos could not be prepared"
              description={
                <Space direction="vertical" size={8}>
                  <Text>
                    These photos could not be prepared for upload. Photos must compress to no more
                    than {(MAX_COMPRESSED_IMAGE_SIZE_BYTES / (1024 * 1024)).toFixed(1)} MiB. Remove
                    them or select replacements before continuing.
                  </Text>
                  {photoPreparationErrors.map((file, index) => (
                    <Button
                      key={`${file.name}-${index}`}
                      size="small"
                      onClick={() => {
                        setPhotoPreparationErrors((failedFiles) =>
                          failedFiles.filter((failedFile) => failedFile !== file)
                        );
                        resetClassificationState();
                      }}
                    >
                      Remove {file.name}
                    </Button>
                  ))}
                </Space>
              }
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            name="description"
            label={reportType === 'text' ? 'Description' : 'Description (optional)'}
            rules={
              reportType === 'text'
                ? [
                    {
                      required: true,
                      min: 10,
                      message: 'Please describe the incident (min. 10 characters).',
                    },
                  ]
                : []
            }
          >
            <Input.TextArea
              rows={4}
              placeholder="Describe the incident in detail..."
              onChange={() => {
                resetClassificationState();
              }}
            />
          </Form.Item>

          <Form.Item
            name="address"
            label="Address (optional)"
            getValueProps={(address: string | undefined) => ({
              value: address?.replace(barangaySuffixPattern, '') ?? '',
            })}
            getValueFromEvent={(event: React.ChangeEvent<HTMLInputElement>) => {
              const address = event.target.value;
              if (!address.trim() || barangaySuffixPattern.test(address)) return address;
              return `${address}, ${barangaySuffix}`;
            }}
          >
            <Input placeholder="Purok, street name..." />
          </Form.Item>
        </div>

        {/* STEP 2: Classification */}
        <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
          {classifyMutation.isPending && !classification && (
            <Alert
              style={{ marginBottom: 16 }}
              type="info"
              showIcon
              icon={<Spin size="small" />}
              message="AI is analyzing your report..."
              description="You can still fill this in manually while you wait."
            />
          )}
          {classification && !manuallyEdited && (
            <Alert
              style={{ marginBottom: 16 }}
              type="success"
              showIcon
              message="AI suggestion applied"
              description="Feel free to adjust any of the fields below if they don't look right."
            />
          )}

          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true, message: 'Please select a category.' }]}
          >
            <Select
              placeholder="Select category"
              options={categories.map((c) => ({
                value: c.name,
                label: c.name,
              }))}
              onChange={() => {
                setManuallyEdited(true);
                form.setFieldValue('subcategory', undefined);
              }}
            />
          </Form.Item>

          <Form.Item
            name="subcategory"
            label="Subcategory"
            rules={[{ required: true, message: 'Please select a subcategory.' }]}
          >
            <Select
              placeholder="Select subcategory"
              disabled={!selectedCategory}
              options={(SUBCATEGORY_MAP[selectedCategory] || []).map((s) => ({
                value: s,
                label: s,
              }))}
              onChange={() => setManuallyEdited(true)}
            />
          </Form.Item>

          <Form.Item
            name="severity"
            label="Severity"
            rules={[{ required: true, message: 'Please select a severity level.' }]}
          >
            <Radio.Group onChange={() => setManuallyEdited(true)}>
              {SEVERITY_OPTIONS.map((s) => (
                <Radio.Button key={s} value={s}>
                  {s}
                </Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>
        </div>

        {/* STEP 3: Review */}
        <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
          <Descriptions bordered column={1} size="middle">
            <Descriptions.Item label="Report Type">
              {reportType === 'text' ? 'Text description' : 'Photo'}
            </Descriptions.Item>
            {fileList.length > 0 && (
              <Descriptions.Item label="Photo(s)">
                <Image.PreviewGroup>
                  <Space wrap size={8}>
                    {fileList.map((f, i) => (
                      <Image
                        key={i}
                        width={64}
                        height={64}
                        style={{ objectFit: 'cover', borderRadius: 6 }}
                        src={URL.createObjectURL(f.originFileObj)}
                      />
                    ))}
                  </Space>
                </Image.PreviewGroup>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Description">
              {form.getFieldValue('description') || <Text type="secondary">None provided</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="Location">
              {form.getFieldValue('address')?.replace(barangaySuffixPattern, '') || (
                <Text type="secondary">Not provided</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Category">
              {[form.getFieldValue('category'), form.getFieldValue('subcategory')]
                .filter(Boolean)
                .join(' · ')}
            </Descriptions.Item>
            <Descriptions.Item label="Severity">
              <SeverityTag severity={form.getFieldValue('severity')} />
            </Descriptions.Item>
          </Descriptions>
        </div>

        {currentStep === 0 && (
          <Checkbox
            className="report-ai-processing-checkbox"
            checked={aiProcessingAcknowledged}
            onChange={(event) => setAiProcessingAcknowledged(event.target.checked)}
            style={{ marginTop: 4 }}
          >
            I understand that my report description and attached photos will be sent to Google
            Gemini to help categorize this report. I will avoid including names or other personal
            details in them.
          </Checkbox>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 12 }}>
          {currentStep > 0 && (
            <Button size="large" style={{ flex: 1, minWidth: 0 }} onClick={goBack}>
              Previous
            </Button>
          )}

          {currentStep < 2 && (
            <Button
              type="primary"
              size="large"
              style={{ flex: 1, minWidth: 0 }}
              onClick={goNext}
              disabled={classifyMutation.isPending}
            >
              Next
            </Button>
          )}

          {currentStep === 2 && (
            <Button
              type="primary"
              size="large"
              style={{ flex: 1, minWidth: 0 }}
              loading={submitMutation.isPending}
              onClick={async () => {
                try {
                  // fallback for incomplete classification
                  const values = await form.validateFields(['category', 'subcategory', 'severity']);
                  submitMutation.mutate({ ...form.getFieldsValue(), ...values });
                } catch {
                  message.error('Select a category, subcategory, and severity before submitting.');
                  setCurrentStep(1);
                }
              }}
            >
              Confirm & Submit
            </Button>
          )}
        </div>
      </Form>
    </div>
  );
}

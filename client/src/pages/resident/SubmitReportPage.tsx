import { useState, useCallback } from "react";
import {
  Form,
  Select,
  Input,
  Button,
  Upload,
  Card,
  Typography,
  message,
  Alert,
  Steps,
  Segmented,
  Radio,
  Descriptions,
  Image,
  Spin,
  Space,
  Tag,
} from "antd";
import {
  UploadOutlined,
  EnvironmentOutlined,
  CameraOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, type Category } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import MapPicker from "../../components/MapPicker";
import type { FeatureCollection } from "geojson";
import { isInsideBarangayBoundary } from "../../components/MapPicker";
import barangayData from "../../data/DMM.json";
const { Title, Text } = Typography;

type ReportType = "text" | "photo";
type Severity = "Low" | "Medium" | "High" | "Critical";

const SEVERITY_OPTIONS: Severity[] = ["Low", "Medium", "High", "Critical"];

const SUBCATEGORY_MAP: Record<string, string[]> = {
  "Public Concerns": ["Sanitation", "Infrastructure"],
  "Blotter Cases": ["Civil", "Criminal"],
  "Emergency Situations": ["Public", "Private"],
};

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

export default function SubmitReportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [form] = Form.useForm<ReportFormValues>();

  const [currentStep, setCurrentStep] = useState(0);
  const [maxStepReached, setMaxStepReached] = useState(0);

  const [reportType, setReportType] = useState<ReportType>("text");
  const [lat, setLat] = useState<number>();
  const [lng, setLng] = useState<number>();
  const [fileList, setFileList] = useState<
    { originFileObj: File; thumbUrl?: string }[]
  >([]);

  const [classification, setClassification] = useState<ClassificationResult>();
  const [manuallyEdited, setManuallyEdited] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/api/reports/categories"),
  });

  const classifyMutation = useMutation({
    mutationFn: async () => {
      const values = form.getFieldsValue();
      const description = values.description || "";
      const formData = new FormData();
      formData.append("description", description);
      // Only send the photo when description is too vague to classify on its own
      const descriptionIsTooShort = description.trim().length < 20;
      if (descriptionIsTooShort && fileList[0]?.originFileObj) {
        formData.append("photo", fileList[0].originFileObj);
      }
      return api.post<ClassificationResult>("/api/reports/classify", formData);
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
    },
    onError: () => {
      message.warning(
        "AI classification unavailable — please select a category manually.",
      );
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (values: ReportFormValues) => {
      const formData = new FormData();
      formData.append("category", values.category);
      formData.append("subcategory", values.subcategory);
      formData.append("severity", values.severity);
      formData.append("description", values.description || "");
      formData.append("address", values.address || "");
      formData.append("latitude", String(lat));
      formData.append("longitude", String(lng));
      fileList.forEach((f) => formData.append("photos", f.originFileObj));
      return api.post("/api/reports", formData);
    },
    onSuccess: () => {
      message.success("Report submitted successfully!");
      queryClient.invalidateQueries({ queryKey: ["my-reports"] });
      navigate("/resident/reports");
    },
    onError: (err: Error) => message.error(err.message),
  });

  const goNext = useCallback(async () => {
    try {
      if (currentStep === 0) {
        const fieldsToCheck = reportType === "text" ? ["description"] : [];
        await form.validateFields(fieldsToCheck);
      }
      if (currentStep === 1) {
        if (!lat || !lng) {
          message.error("Please set a location on the map or use GPS.");
          return;
        }
        classifyMutation.mutate();
      }
      const next = currentStep + 1;
      setCurrentStep(next);
      setMaxStepReached((m) => Math.max(m, next));
    } catch {}
  }, [currentStep, reportType, lat, lng, classifyMutation, form]);

  const goBack = () => setCurrentStep((s) => Math.max(0, s - 1));

  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      message.error("GPS is not available on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point: [number, number] = [
          pos.coords.latitude,
          pos.coords.longitude,
        ];
        const isInside = isInsideBarangayBoundary(
          point,
          barangayData as FeatureCollection,
        );

        if (!isInside) {
          message.error(
            "Your current location is outside the barangay boundary.",
          );
          return;
        }

        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        message.success("Location detected via GPS.");
      },
      () =>
        message.error(
          "Could not get your location. Please tap the map instead.",
        ),
    );
  };

  if (!profile?.emailVerified) {
    return (
      <Alert
        type="warning"
        message="Email verification required"
        description="Please verify your email before submitting reports. Check your inbox for the verification link."
        showIcon
      />
    );
  }

  const selectedCategory = Form.useWatch("category", form);
  const STEP_LABELS = ["Report Type", "Location", "Classification", "Review"];

  return (
    <Card>
      <Title
        level={3}
        style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}
      >
        SUBMIT INCIDENT REPORT
      </Title>

      <Steps
        current={currentStep}
        size="small"
        responsive={false}
        onChange={(step) => {
          if (step <= maxStepReached) setCurrentStep(step);
        }}
        style={{ marginBottom: 32, cursor: "pointer" }}
        items={[{}, {}, {}, {}]}
      />

      <Title
        level={4}
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          letterSpacing: 0,
          marginTop: 8,
        }}
      >
        {STEP_LABELS[currentStep]}
      </Title>

      <Form
        form={form}
        layout="vertical"
        initialValues={{ reportType: "text" }}
      >
        {/* STEP 1: Report Type */}
        <div style={{ display: currentStep === 0 ? "block" : "none" }}>
          <Form.Item label="How would you like to report this?">
            <Segmented
              block
              value={reportType}
              onChange={(val) => setReportType(val as ReportType)}
              options={[
                {
                  label: "Text description",
                  value: "text",
                  icon: <FileTextOutlined />,
                },
                {
                  label: "Take a photo",
                  value: "photo",
                  icon: <CameraOutlined />,
                },
              ]}
            />
          </Form.Item>

          {reportType === "photo" && (
            <Form.Item label="Photo (max 3)">
              <Upload
                listType="picture-card"
                beforeUpload={() => false}
                maxCount={3}
                accept="image/*"
                capture="environment"
                fileList={fileList as any}
                onChange={({ fileList: fl }) => setFileList(fl as any)}
              >
                {fileList.length < 3 && (
                  <div>
                    <UploadOutlined />
                    <div style={{ marginTop: 8 }}>Upload</div>
                  </div>
                )}
              </Upload>
            </Form.Item>
          )}

          <Form.Item
            name="description"
            label={
              reportType === "text" ? "Description" : "Description (optional)"
            }
            rules={
              reportType === "text"
                ? [
                    {
                      required: true,
                      min: 10,
                      message:
                        "Please describe the incident (min. 10 characters).",
                    },
                  ]
                : []
            }
          >
            <Input.TextArea
              rows={4}
              placeholder="Describe the incident in detail..."
            />
          </Form.Item>
        </div>

        {/* STEP 2: Location */}
        <div style={{ display: currentStep === 1 ? "block" : "none" }}>
          <Form.Item label="Location (tap map or use GPS)">
            <Space direction="vertical" style={{ width: "100%" }}>
              <Button icon={<EnvironmentOutlined />} onClick={handleUseGPS}>
                Use My Current Location
              </Button>
              <MapPicker
                latitude={lat}
                longitude={lng}
                onChange={(la, ln) => {
                  setLat(la);
                  setLng(ln);
                }}
              />
            </Space>
          </Form.Item>

          <Form.Item name="address" label="Address (optional)">
            <Input placeholder="Purok, street name..." />
          </Form.Item>
        </div>

        {/* STEP 3: Classification */}
        <div style={{ display: currentStep === 2 ? "block" : "none" }}>
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
            rules={[{ required: true, message: "Please select a category." }]}
          >
            <Select
              placeholder="Select category"
              options={categories.map((c) => ({
                value: c.name,
                label: c.name,
              }))}
              onChange={() => {
                setManuallyEdited(true);
                form.setFieldValue("subcategory", undefined);
              }}
            />
          </Form.Item>

          <Form.Item
            name="subcategory"
            label="Subcategory"
            rules={[
              { required: true, message: "Please select a subcategory." },
            ]}
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
            rules={[
              { required: true, message: "Please select a severity level." },
            ]}
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

        {/* STEP 4: Review */}
        <div style={{ display: currentStep === 3 ? "block" : "none" }}>
          <Descriptions bordered column={1} size="middle">
            <Descriptions.Item label="Report Type">
              {reportType === "text" ? "Text description" : "Photo"}
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
                        style={{ objectFit: "cover", borderRadius: 6 }}
                        src={URL.createObjectURL(f.originFileObj)}
                      />
                    ))}
                  </Space>
                </Image.PreviewGroup>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Description">
              {form.getFieldValue("description") || (
                <Text type="secondary">None provided</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Location">
              {lat && lng ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : "Not set"}
            </Descriptions.Item>
            <Descriptions.Item label="Address">
              {form.getFieldValue("address") || (
                <Text type="secondary">Not provided</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Category">
              <Tag color="blue">{form.getFieldValue("category")}</Tag>
              <Tag>{form.getFieldValue("subcategory")}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Severity">
              <Tag color="red">{form.getFieldValue("severity")}</Tag>
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* Navigation */}
        <Space style={{ marginTop: 32 }}>
          {currentStep > 0 && <Button onClick={goBack}>Previous</Button>}
          {currentStep < 3 && (
            <Button type="primary" onClick={goNext}>
              Next
            </Button>
          )}
          {currentStep === 3 && (
            <Button
              type="primary"
              danger
              size="large"
              loading={submitMutation.isPending}
              onClick={() => submitMutation.mutate(form.getFieldsValue())}
            >
              Confirm & Submit
            </Button>
          )}
        </Space>
      </Form>
    </Card>
  );
}

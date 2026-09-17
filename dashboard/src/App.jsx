import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Camera,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  MapPin,
  ScanLine,
  ShieldCheck,
  Share2,
  Upload,
  Video,
  X,
  MapPinned,
  RotateCcw,
} from "lucide-react";

import { motion } from "framer-motion";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import "./App.css";


const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const SHARE_DESCRIPTION =
  "RoadVision AI is an AI-powered road monitoring system designed to detect road defects, assess road health, and support smarter road maintenance decisions.";

const createInspectionMarkerIcon = (severity) => {
  const normalizedSeverity =
    severity?.toLowerCase() || "moderate";

  return L.divIcon({
    className: "roadvision-map-marker",
    html: `
      <div class="roadvision-marker-pin marker-${normalizedSeverity}">
        <span></span>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -22],
  });
};
function MapBoundsController({
  inspections,
  selectedInspectionId,
  markerRefs,
}) {
  const map = useMap();

  useEffect(() => {
    const validInspections = inspections.filter(
      (inspection) =>
        inspection.latitude != null &&
        inspection.longitude != null
    );

    if (!validInspections.length) {
      return;
    }

    if (selectedInspectionId) {
      const selectedInspection = validInspections.find(
        (inspection) =>
          inspection.id === selectedInspectionId
      );

      if (selectedInspection) {
        const position = [
          Number(selectedInspection.latitude),
          Number(selectedInspection.longitude),
        ];

        map.setView(position, 15, {
          animate: true,
        });

        setTimeout(() => {
          markerRefs.current[selectedInspection.id]?.openPopup();
        }, 350);

        return;
      }
    }

    const bounds = validInspections.map((inspection) => [
      Number(inspection.latitude),
      Number(inspection.longitude),
    ]);

    if (bounds.length === 1) {
      map.setView(bounds[0], 13);
    } else {
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 14,
      });
    }
  }, [
    inspections,
    selectedInspectionId,
    markerRefs,
    map,
  ]);

  return null;
}


function PublicAnalysisPage({ inspectionId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const publicUrl = `${window.location.origin}/analysis/${inspectionId}`;

  useEffect(() => {
    const loadInspection = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/public/inspection/${inspectionId}`
        );

        if (!response.ok) {
          throw new Error("Unable to load inspection.");
        }

        const result = await response.json();

        if (result.status !== "ok") {
          throw new Error(result.message || "Inspection not found.");
        }

        setData(result);
      } catch (err) {
        console.error(err);
        setError("This public inspection could not be found.");
      } finally {
        setLoading(false);
      }
    };

    loadInspection();
  }, [inspectionId]);

  const absoluteMediaUrl = (path) => {
    if (!path) return "";
    return path.startsWith("http")
      ? path
      : `${API_BASE_URL}${path}`;
  };

  const downloadMedia = async () => {
    if (!data?.inspection?.analyzed_media) return;

    try {
      const response = await fetch(
        absoluteMediaUrl(data.inspection.analyzed_media)
      );

      if (!response.ok) throw new Error("Download failed.");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `${
        data.inspection.filename.replace(/\.[^/.]+$/, "")
      }_roadvision.${
        data.inspection.media_type === "image" ? "jpg" : "mp4"
      }`;

      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Unable to download the analyzed media.");
    }
  };

  const generatePublicReportPdf = () => {
    if (!data?.report) return null;

    const report = data.report;
    const health = report.road_condition || {};
    const breakdown = report.damage_summary?.breakdown || {};
    const detections = Array.isArray(report.detections)
      ? report.detections
      : [];

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 16;

    const safe = (value) =>
      String(value ?? "Not specified");

    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, pageWidth, 4, "F");

    doc.setTextColor(124, 58, 237);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("ROADVISION AI", margin, 15);

    doc.setTextColor(30, 25, 36);
    doc.setFontSize(22);
    doc.text("Inspection Report", margin, 25);

    doc.setTextColor(105, 98, 113);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      "Intelligent Rural Road Condition & Infrastructure Monitoring System",
      margin,
      31
    );

    let y = 42;

    const sectionTitle = (title) => {
      doc.setTextColor(124, 58, 237);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(title.toUpperCase(), margin, y);
      doc.setDrawColor(226, 221, 231);
      doc.line(margin, y + 3, pageWidth - margin, y + 3);
      y += 9;
    };

    sectionTitle("Inspection Details");

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [["Field", "Details"]],
      body: [
        ["Inspection File", safe(report.inspection?.image)],
        ["Inspection Date", safe(report.inspection?.date)],
        ["Road / Route", safe(report.inspection?.road_name)],
        ["Area / Village", safe(report.inspection?.location_name)],
      ],
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 3.5,
        textColor: [40, 35, 45],
      },
      headStyles: {
        fillColor: [245, 242, 247],
        textColor: [100, 92, 108],
        fontStyle: "bold",
      },
    });

    y = doc.lastAutoTable.finalY + 14;
    sectionTitle("Road Condition");

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [["Health Score", "Severity", "Maintenance Priority"]],
      body: [[
        `${safe(health.health_score)} / 100`,
        safe(health.severity),
        safe(health.maintenance_priority),
      ]],
      styles: {
        font: "helvetica",
        fontSize: 10,
        cellPadding: 5,
        textColor: [40, 35, 45],
        halign: "center",
      },
      headStyles: {
        fillColor: [124, 58, 237],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
      },
    });

    y = doc.lastAutoTable.finalY + 14;
    sectionTitle("Damage Summary");

    const damageRows = Object.entries(breakdown).map(
      ([defect, count]) => [defect, String(count)]
    );

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [["Detected Defect", "Count"]],
      body: damageRows.length
        ? damageRows
        : [["No defects detected.", "0"]],
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 3.5,
        textColor: [40, 35, 45],
      },
      headStyles: {
        fillColor: [245, 242, 247],
        textColor: [100, 92, 108],
        fontStyle: "bold",
      },
    });

    y = doc.lastAutoTable.finalY + 14;
    sectionTitle("Detection Details");

    const detectionRows = detections.map(
      (detection, index) => [
        String(index + 1),
        safe(detection.class),
        `${(Number(detection.confidence) * 100).toFixed(1)}%`,
      ]
    );

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [["#", "Detected Defect", "Confidence"]],
      body: detectionRows.length
        ? detectionRows
        : [["-", "No individual detections recorded.", "-"]],
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 3.5,
        textColor: [40, 35, 45],
      },
      headStyles: {
        fillColor: [245, 242, 247],
        textColor: [100, 92, 108],
        fontStyle: "bold",
      },
    });

    y = doc.lastAutoTable.finalY + 14;
    sectionTitle("AI Recommendation");

    doc.setFillColor(255, 247, 240);
    doc.setDrawColor(242, 139, 69);
    doc.rect(margin, y, pageWidth - margin * 2, 22, "FD");

    doc.setTextColor(160, 76, 19);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("MAINTENANCE GUIDANCE", margin + 5, y + 7);

    doc.setTextColor(62, 52, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    const recommendationLines = doc.splitTextToSize(
      safe(report.recommendation),
      pageWidth - margin * 2 - 10
    );

    doc.text(recommendationLines, margin + 5, y + 13);

    for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
      doc.setPage(page);
      doc.setDrawColor(228, 223, 231);
      doc.line(margin, 285, pageWidth - margin, 285);
      doc.setTextColor(129, 123, 133);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(
        "Generated automatically by RoadVision AI · Prototype System",
        pageWidth / 2,
        290,
        { align: "center" }
      );
    }

    const baseName =
      (report.inspection?.image || "roadvision_inspection")
        .replace(/\.[^/.]+$/, "");

    return {
      blob: doc.output("blob"),
      filename: `${baseName}_roadvision_report.pdf`,
    };
  };

  const downloadReport = () => {
    const pdf = generatePublicReportPdf();
    if (!pdf) return;

    const url = URL.createObjectURL(pdf.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = pdf.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const copyPublicUrl = async () => {
    const shareText = `${SHARE_DESCRIPTION}

View the complete inspection analysis:
${publicUrl}`;

    try {
      await navigator.clipboard.writeText(shareText);
      alert("Inspection link and description copied.");
    } catch (err) {
      console.error(err);
      alert("Unable to copy the inspection link.");
    }
  };

  const shareInspection = async () => {
    const shareText = `${SHARE_DESCRIPTION}

Inspection: ${
      data?.inspection?.filename || "road inspection"
    }
Health Score: ${
      data?.report?.road_condition?.health_score ?? "-"
    }/100
Severity: ${
      data?.report?.road_condition?.severity || "Not specified"
    }

View the complete inspection analysis:`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "RoadVision AI Inspection",
          text: shareText,
          url: publicUrl,
        });
        return;
      }

      await navigator.clipboard?.writeText(
        `${shareText}
${publicUrl}`
      );
      alert("Public inspection link copied.");
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error(err);
      }
    }
  };

  const shareWhatsApp = () => {
    const message = `${SHARE_DESCRIPTION}

Inspection: ${
      data?.inspection?.filename || "Road inspection"
    }
Road: ${
      data?.inspection?.road_name || "Not specified"
    }
Location: ${
      data?.inspection?.location_name || "Not specified"
    }
Health Score: ${
      data?.report?.road_condition?.health_score ?? "-"
    }/100
Severity: ${
      data?.report?.road_condition?.severity || "Not specified"
    }

View the complete inspection analysis:
${publicUrl}`;

    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  if (loading) {
    return (
      <div className="public-analysis-page">
        <div className="public-analysis-shell public-analysis-loading">
          <div className="public-analysis-spinner" />
          <h2>Loading RoadVision inspection...</h2>
          <p>Retrieving the public analysis report.</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="public-analysis-page">
        <div className="public-analysis-shell public-analysis-empty">
          <AlertTriangle size={32} />
          <h2>Inspection not found</h2>
          <p>The public RoadVision analysis link is invalid or unavailable.</p>
        </div>
      </div>
    );
  }

  const inspection = data.inspection;
  const report = data.report;
  const health = report.road_condition || {};
  const breakdown = report.damage_summary?.breakdown || {};
  const detections = Array.isArray(report.detections)
    ? report.detections
    : [];

  const analyzedMedia = absoluteMediaUrl(inspection.analyzed_media);
  const originalMedia = absoluteMediaUrl(inspection.original_media);
  const isImageMedia = inspection.media_type === "image";

  return (
    <div className="public-analysis-page">
      <header className="public-analysis-topbar">
        <div className="public-analysis-brand">
          <div className="public-analysis-brand-icon logo-image-wrap">
            <img
              src="/roadvision-logo.png"
              alt="RoadVision AI"
              className="roadvision-logo"
            />
          </div>
          <div>
            <strong>RoadVision AI</strong>
            <span>Intelligent Road Monitoring</span>
          </div>
        </div>

        <div className="public-analysis-actions">
          <button type="button" onClick={shareInspection}>
            <Share2 size={16} />
            Share
          </button>
          <button type="button" onClick={shareWhatsApp}>
            <span className="whatsapp-symbol" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17">
                <path
                  fill="currentColor"
                  d="M20.5 3.5A11.85 11.85 0 0 0 12.08 0C5.5 0 .15 5.35.15 11.93c0 2.1.55 4.15 1.6 5.96L.05 24l6.25-1.64a11.9 11.9 0 0 0 5.77 1.48h.01c6.58 0 11.93-5.35 11.93-11.93 0-3.19-1.24-6.19-3.51-8.41Zm-8.42 16.3h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.71.98.99-3.62-.23-.37a9.87 9.87 0 1 1 8.35 4.6Zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.48-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.09 4.49.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.69.25-1.28.17-1.41-.07-.12-.27-.2-.57-.35Z"
                />
              </svg>
            </span>
            WhatsApp
          </button>
        </div>
      </header>

      <main className="public-analysis-shell">
        <section className="public-analysis-hero">
          <span className="section-label">ROADVISION AI · PUBLIC INSPECTION</span>
          <h1>Road Inspection Analysis</h1>
          <p>
            AI-powered road condition assessment with the original and
            analyzed inspection media.
          </p>
          <div className="public-analysis-link">
            <MapPin size={15} />
            <span>{publicUrl}</span>
            <button
              type="button"
              onClick={copyPublicUrl}
              title="Copy inspection URL"
            >
              <Copy size={14} />
              Copy URL
            </button>
          </div>
        </section>

        <section className="public-media-grid">
          <div className="public-media-card">
            <div className="public-card-heading">
              <div>
                <span>ORIGINAL MEDIA</span>
                <strong>{inspection.filename}</strong>
              </div>
            </div>

            <div className="public-media-frame">
              {isImageMedia ? (
                <img src={originalMedia} alt="Original road inspection" />
              ) : (
                <video src={originalMedia} controls playsInline />
              )}
            </div>
          </div>

          <div className="public-media-card analyzed">
            <div className="public-card-heading">
              <div>
                <span>AI-ANALYZED MEDIA</span>
                <strong>RoadVision V4 Detection</strong>
              </div>
              <ScanLine size={18} />
            </div>

            <div className="public-media-frame">
              {isImageMedia ? (
                <img src={analyzedMedia} alt="AI analyzed road inspection" />
              ) : (
                <video src={analyzedMedia} controls playsInline />
              )}
            </div>
          </div>
        </section>

        <section className="public-details-grid">
          <div className="public-detail">
            <span>ROAD / ROUTE</span>
            <strong>{inspection.road_name || "Not specified"}</strong>
          </div>
          <div className="public-detail">
            <span>AREA / VILLAGE</span>
            <strong>{inspection.location_name || "Not specified"}</strong>
          </div>
          <div className="public-detail">
            <span>INSPECTION DATE</span>
            <strong>{report.inspection?.date || inspection.created_at}</strong>
          </div>
          <div className="public-detail">
            <span>TOTAL DEFECTS</span>
            <strong>{report.damage_summary?.total_defects ?? 0}</strong>
          </div>
        </section>

        <section className="public-health-layout">
          <div className="public-health-card">
            <span>ROAD HEALTH SCORE</span>
            <strong>{health.health_score ?? 0}</strong>
            <small>/ 100</small>
            <div className={`public-severity ${health.severity?.toLowerCase()}`}>
              <span />
              {health.severity || "Unknown"}
            </div>
          </div>

          <div className="public-condition-card">
            <span>MAINTENANCE PRIORITY</span>
            <strong>{health.maintenance_priority || "Not specified"}</strong>
            <p>
              {report.recommendation || "Further inspection recommended."}
            </p>
          </div>
        </section>

        <section className="public-results-card">
          <div className="public-section-heading">
            <div>
              <span>AI RESULTS</span>
              <h2>Detected Road Defects</h2>
            </div>
            <AlertTriangle size={19} />
          </div>

          <div className="public-defect-list">
            {Object.entries(breakdown).length > 0 ? (
              Object.entries(breakdown).map(([defect, count]) => (
                <div className="public-defect-row" key={defect}>
                  <div>
                    <span />
                    <strong>{defect}</strong>
                  </div>
                  <strong>{count}</strong>
                </div>
              ))
            ) : (
              <div className="public-no-defects">No defects detected.</div>
            )}
          </div>

          {detections.length > 0 && (
            <div className="public-detection-list">
              <span>DETECTION CONFIDENCE</span>
              {detections.map((detection, index) => {
                const confidence =
                  Number(detection.confidence || 0) * 100;

                return (
                  <div className="public-detection-row" key={`${detection.class}-${index}`}>
                    <div>
                      <strong>{detection.class}</strong>
                      <div className="public-confidence-bar">
                        <div style={{ width: `${confidence}%` }} />
                      </div>
                    </div>
                    <strong>{confidence.toFixed(1)}%</strong>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="public-action-card">
          <div>
            <span>SHAREABLE INSPECTION</span>
            <h2>Use this permanent inspection link</h2>
            <p>
              Anyone with this link can view the saved RoadVision analysis.
            </p>
          </div>

          <div className="public-action-buttons">
            <button type="button" onClick={downloadMedia}>
              <Download size={17} />
              Download Analysis
            </button>
            <button type="button" onClick={downloadReport}>
              <FileText size={17} />
              Download Report
            </button>
            <button type="button" onClick={shareInspection}>
              <Share2 size={17} />
              Native Share
            </button>
            <button type="button" onClick={shareWhatsApp}>
              <span className="whatsapp-symbol" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17">
                <path
                  fill="currentColor"
                  d="M20.5 3.5A11.85 11.85 0 0 0 12.08 0C5.5 0 .15 5.35.15 11.93c0 2.1.55 4.15 1.6 5.96L.05 24l6.25-1.64a11.9 11.9 0 0 0 5.77 1.48h.01c6.58 0 11.93-5.35 11.93-11.93 0-3.19-1.24-6.19-3.51-8.41Zm-8.42 16.3h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.71.98.99-3.62-.23-.37a9.87 9.87 0 1 1 8.35 4.6Zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.48-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.09 4.49.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.69.25-1.28.17-1.41-.07-.12-.27-.2-.57-.35Z"
                />
              </svg>
            </span>
              WhatsApp
            </button>
          </div>
        </section>

        <footer className="public-analysis-footer">
          <ShieldCheck size={15} />
          Generated automatically by RoadVision AI · Prototype System
        </footer>
      </main>
    </div>
  );
}

function App() {

  const publicPathMatch = window.location.pathname.match(
    /^\/analysis\/([^/]+)\/?$/
  );

  const [selectedInspectionId, setSelectedInspectionId] =
  useState(null);
  const [mapSeverityFilter, setMapSeverityFilter] =
  useState("All");
  const [isResettingMap, setIsResettingMap] =
  useState(false);
  const markerRefs = useRef({});
  const [file, setFile] = useState(null);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordedBytesRef = useRef(0);
  const recordingTimerRef = useRef(null);
  const [cameraMode, setCameraMode] = useState("image");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingSize, setRecordingSize] = useState(0);
  const analysisAbortControllerRef = useRef(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState("");
  const [error, setError] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [roadName, setRoadName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationSkipped, setLocationSkipped] = useState(false);
  const [skipLocationRequested, setSkipLocationRequested] = useState(false);
  const [mapPosition, setMapPosition] = useState([
    20.2961,
    85.8245,
  ]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState(() => {
    try {
      const savedHistory = localStorage.getItem(
        "roadvision_analysis_history"
      );

      return savedHistory ? JSON.parse(savedHistory) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(
      "roadvision_analysis_history",
      JSON.stringify(analysisHistory)
    );
  }, [analysisHistory]);

  useEffect(() => {
  const repairExistingHistory = async () => {
    const repairKey = "roadvision_location_repair_v1";

    if (localStorage.getItem(repairKey)) {
      return;
    }

    if (!analysisHistory.length) {
      return;
    }

    let changed = false;
    const repairedHistory = [];

    for (const inspection of analysisHistory) {
      const query = [
        inspection.roadName,
        inspection.locationName,
      ]
        .filter(Boolean)
        .join(", ")
        .trim();

      if (!query) {
        repairedHistory.push(inspection);
        continue;
      }

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`
        );

        if (!response.ok) {
          repairedHistory.push(inspection);
          continue;
        }

        const results = await response.json();

        if (results.length > 0) {
          const latitude = Number(results[0].lat);
          const longitude = Number(results[0].lon);

          repairedHistory.push({
            ...inspection,
            latitude,
            longitude,
          });

          if (
            inspection.latitude !== latitude ||
            inspection.longitude !== longitude
          ) {
            changed = true;
          }
        } else {
          repairedHistory.push(inspection);
        }
      } catch {
        repairedHistory.push(inspection);
      }

      // Avoid sending requests too quickly to Nominatim.
      await new Promise((resolve) =>
        setTimeout(resolve, 1100)
      );
    }

    if (changed) {
      setAnalysisHistory(repairedHistory);
    }

    localStorage.setItem(repairKey, "true");
  };

    repairExistingHistory();
  // Run this migration only once for existing history.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
  const filteredMapInspections =
    analysisHistory.filter((inspection) => {
      if (
        inspection.latitude == null ||
        inspection.longitude == null
      ) {
        return false;
      }

      return (
        mapSeverityFilter === "All" ||
        inspection.severity === mapSeverityFilter
      );
    });


  const isImage = file?.type?.startsWith("image/");
  const isVideo = file?.type?.startsWith("video/");

  const geocodeInspectionLocation = async (signal) => {
    const query = [roadName, locationName]
      .filter(Boolean)
      .join(", ")
      .trim();

    if (!query) {
      return;
    }

    

    setIsGeocoding(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`,
        { signal }
      );

      if (!response.ok) {
        throw new Error("Geocoding request failed.");
      }

      const results = await response.json();

      if (results.length > 0) {
  const coordinates = [
    Number(results[0].lat),
    Number(results[0].lon),
  ];

  setMapPosition(coordinates);

  return coordinates;
}

return null;
    } catch (error) {
      console.error(
        "Location lookup failed:",
        error
      );
    } finally {
      setIsGeocoding(false);
    }
  };

  const openSelectedMedia = () => {
    if (!file) {
      return;
    }

    const mediaUrl = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = mediaUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    link.remove();

    // Keep the object URL available while the new tab loads the media.
    setTimeout(() => {
      URL.revokeObjectURL(mediaUrl);
    }, 60000);
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);
    setAnalysisResult(null);
    setError("");
    setShowUploadOptions(false);
    event.target.value = "";
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const MAX_RECORDING_MS = 60 * 1000;
  const MAX_RECORDING_BYTES = 500 * 1024 * 1024;

  const clearRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const stopCameraStream = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }

    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
  };

  const stopRecording = (reason = "manual") => {
    clearRecordingTimer();

    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    if (reason === "manual") {
      setIsRecording(false);
    }
  };

  const stopCamera = () => {
    clearRecordingTimer();

    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }

    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    recordedBytesRef.current = 0;
    setIsRecording(false);
    setRecordingSeconds(0);
    setRecordingSize(0);

    stopCameraStream();
    setShowCamera(false);
  };

  const openCamera = async () => {
    setShowUploadOptions(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Camera access is not supported by this browser. Please use Files instead."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      cameraStreamRef.current = stream;
      setCameraMode("image");
      setIsRecording(false);
      setRecordingSeconds(0);
      setRecordingSize(0);
      setShowCamera(true);
      setError("");
    } catch (cameraError) {
      console.error("Camera access failed:", cameraError);

      setError(
        "Unable to access the camera. Please allow camera permission or use Files instead."
      );
    }
  };

  useEffect(() => {
    if (!showCamera || !cameraVideoRef.current || !cameraStreamRef.current) {
      return;
    }

    cameraVideoRef.current.srcObject = cameraStreamRef.current;
    cameraVideoRef.current.play().catch(() => {});

    return () => {
      clearRecordingTimer();
    };
  }, [showCamera]);

  const selectCameraMode = (mode) => {
    if (isRecording) {
      return;
    }

    setCameraMode(mode);
    setRecordingSeconds(0);
    setRecordingSize(0);
  };

  const startRecording = () => {
    if (!cameraStreamRef.current || isRecording) {
      return;
    }

    if (!window.MediaRecorder) {
      setError(
        "Video recording is not supported by this browser. Please use Files instead."
      );
      return;
    }

    const supportedTypes = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];

    const mimeType = supportedTypes.find((type) =>
      MediaRecorder.isTypeSupported(type)
    );

    try {
      const recorder = mimeType
        ? new MediaRecorder(cameraStreamRef.current, { mimeType })
        : new MediaRecorder(cameraStreamRef.current);

      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      recordedBytesRef.current = 0;

      setRecordingSeconds(0);
      setRecordingSize(0);
      setIsRecording(true);

      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) {
          return;
        }

        recordedChunksRef.current.push(event.data);
        recordedBytesRef.current += event.data.size;

        setRecordingSize(recordedBytesRef.current);

        if (recordedBytesRef.current >= MAX_RECORDING_BYTES) {
          stopRecording("size");
        }
      };

      recorder.onstop = () => {
        clearRecordingTimer();
        setIsRecording(false);

        const totalBytes = recordedBytesRef.current;

        if (!recordedChunksRef.current.length) {
          setError("No video was recorded. Please try again.");
          return;
        }

        if (totalBytes > MAX_RECORDING_BYTES) {
          recordedChunksRef.current = [];
          recordedBytesRef.current = 0;
          setRecordingSize(0);
          setError(
            "The recorded video exceeded the 500 MB limit. Please record a shorter or lower-resolution video."
          );
          return;
        }

        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || "video/webm",
        });

        const extension = blob.type.includes("webm") ? "webm" : "webm";
        const recordedFile = new File(
          [blob],
          `roadvision_camera_${Date.now()}.${extension}`,
          { type: blob.type || "video/webm" }
        );

        setFile(recordedFile);
        setAnalysisResult(null);
        setError("");
        recordedChunksRef.current = [];
        recordedBytesRef.current = 0;
        setRecordingSize(0);

        stopCameraStream();
        setShowCamera(false);
        setCameraMode("image");
      };

      recorder.onerror = () => {
        clearRecordingTimer();
        setIsRecording(false);
        setError(
          "Video recording failed. Please try again or use Files instead."
        );
      };

      recorder.start(1000);

      const startedAt = Date.now();

      recordingTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setRecordingSeconds(Math.min(elapsed, 60));

        if (Date.now() - startedAt >= MAX_RECORDING_MS) {
          stopRecording("time");
        }
      }, 250);
    } catch (recordingError) {
      console.error("Video recording failed:", recordingError);
      setIsRecording(false);
      setError(
        "Unable to start video recording. Please try again or use Files instead."
      );
    }
  };

  const cancelRecording = () => {
    clearRecordingTimer();

    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => {
        clearRecordingTimer();
        mediaRecorderRef.current = null;
        recordedChunksRef.current = [];
        recordedBytesRef.current = 0;
        setIsRecording(false);
        setRecordingSeconds(0);
        setRecordingSize(0);
      };
      recorder.stop();
    } else {
      setIsRecording(false);
    }
  };

  useEffect(() => {
    return () => {
      clearRecordingTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      stopCameraStream();
    };
  }, []);

  const captureCameraPhoto = () => {
    const video = cameraVideoRef.current;

    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("Camera is not ready yet. Please try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setError("Unable to capture the camera image.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Unable to create the captured photo.");
          return;
        }

        const capturedFile = new File(
          [blob],
          `roadvision_camera_${Date.now()}.jpg`,
          { type: "image/jpeg" }
        );

        setFile(capturedFile);
        setAnalysisResult(null);
        setError("");
        stopCamera();
      },
      "image/jpeg",
      0.92
    );
  };

  const runAnalysisRequest = (
    endpoint,
    formData,
    controller,
    mediaType
  ) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open("POST", `${API_BASE_URL}${endpoint}`);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          setAnalysisProgress((previous) =>
            Math.max(previous, 10)
          );
          setAnalysisStage(`Uploading ${mediaType}...`);
          return;
        }

        const uploadProgress = Math.round(
          (event.loaded / event.total) * 70
        );

        setAnalysisProgress(Math.min(uploadProgress, 70));
        setAnalysisStage(
          `Uploading ${mediaType}...`
        );
      };

      xhr.upload.onload = () => {
        setAnalysisProgress(70);
        setAnalysisStage(
          `AI is processing the ${mediaType.toLowerCase()}...`
        );
      };

      xhr.onprogress = () => {
        // The backend keeps the request open while inference is running.
        // Keep the visible progress between 70% and 95% until the result arrives.
        setAnalysisProgress((previous) =>
          Math.min(Math.max(previous, 70), 95)
        );
        setAnalysisStage(
          `AI is processing the ${mediaType.toLowerCase()}...`
        );
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setAnalysisProgress(100);
          setAnalysisStage("Analysis complete.");
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(
              new Error("Invalid response from the RoadVision backend.")
            );
          }
          return;
        }

        reject(
          new Error(
            `${mediaType} analysis failed with status ${xhr.status}.`
          )
        );
      };

      xhr.onerror = () => {
        reject(
          new Error(
            `Unable to connect to the RoadVision backend for ${mediaType.toLowerCase()} analysis.`
          )
        );
      };

      xhr.onabort = () => {
        const abortError = new Error("Analysis cancelled.");
        abortError.name = "AbortError";
        reject(abortError);
      };

      const handleAbort = () => {
        if (xhr.readyState !== XMLHttpRequest.DONE) {
          xhr.abort();
        }
      };

      if (controller.signal.aborted) {
        handleAbort();
        return;
      }

      controller.signal.addEventListener(
        "abort",
        handleAbort,
        { once: true }
      );

      xhr.send(formData);
    });
  };

  const handleImageAnalysis = async () => {
    if (!file || !isImage) {
      return;
    }

    if (!locationSkipped && !locationName.trim()) {
      setError(
        "Please enter the inspection location or choose 'I don't know the road or location'."
      );
      return;
    }

    const controller = new AbortController();
    analysisAbortControllerRef.current = controller;

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisStage("Preparing image...");
    setError("");
    setAnalysisResult(null);
    setShowReport(false);

    try {
      const coordinates = await geocodeInspectionLocation(
        controller.signal
      );
      setAnalysisProgress(5);
      setAnalysisStage("Preparing image for AI inspection...");

      const formData = new FormData();

      formData.append("file", file);
      formData.append("road_name", roadName);
      formData.append("location_name", locationName);

      const data = await runAnalysisRequest(
        "/api/analyze/image",
        formData,
        controller,
        "Image"
      );

      setAnalysisResult(data);

      setAnalysisHistory((previous) => [
        {
          id: Date.now(),
          inspectionId: data.inspection_id || null,
          publicPath: data.public_path || null,
          filename: data.filename || file.name,
          type: "Image",
          roadName,
locationName,
latitude: coordinates
  ? coordinates[0]
  : null,
longitude: coordinates
  ? coordinates[1]
  : null,
score: data.health.score,
          severity: data.health.severity,
          priority: data.health.priority,
          damageCount: data.health.damage_count,
          damageBreakdown: data.health.damage_breakdown || {},
          timestamp: new Date().toLocaleString(),
        },
        ...previous,
      ].slice(0, 10));
    } catch (err) {
      if (err?.name === "AbortError") {
        setError("Analysis cancelled.");
        return;
      }

      console.error(err);

      setError(
        "Unable to analyze the image. Make sure the RoadVision backend is running."
      );
    } finally {
      if (analysisAbortControllerRef.current === controller) {
        analysisAbortControllerRef.current = null;
      }
      setIsAnalyzing(false);
      setAnalysisProgress(0);
      setAnalysisStage("");
    }
  };

  const handleVideoAnalysis = async () => {
    if (!file || !isVideo) {
      return;
    }

    if (!locationSkipped && !locationName.trim()) {
      setError(
        "Please enter the inspection location or choose 'I don't know the road or location'."
      );
      return;
    }

    const controller = new AbortController();
    analysisAbortControllerRef.current = controller;

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisStage("Preparing video...");
    setError("");
    setAnalysisResult(null);
    setShowReport(false);

    try {
      const coordinates = await geocodeInspectionLocation(
        controller.signal
      );
      setAnalysisProgress(5);
      setAnalysisStage("Preparing video for AI inspection...");

      const formData = new FormData();

      formData.append("file", file);
      formData.append("road_name", roadName);
      formData.append("location_name", locationName);

      const data = await runAnalysisRequest(
        "/api/analyze/video",
        formData,
        controller,
        "Video"
      );

      setAnalysisResult(data);

      setAnalysisHistory((previous) => [
        {
          id: Date.now(),
          inspectionId: data.inspection_id || null,
          publicPath: data.public_path || null,
          filename: data.filename || file.name,
          type: "Video",
          roadName,
locationName,
latitude: coordinates
  ? coordinates[0]
  : null,
longitude: coordinates
  ? coordinates[1]
  : null,
score: data.health.score,
          severity: data.health.severity,
          priority: data.health.priority,
          damageCount: data.health.damage_count,
          damageBreakdown: data.health.damage_breakdown || {},
          timestamp: new Date().toLocaleString(),
        },
        ...previous,
      ].slice(0, 10));
    } catch (err) {
      if (err?.name === "AbortError") {
        setError("Analysis cancelled.");
        return;
      }

      console.error(err);

      setError(
        "Unable to analyze the video. Make sure the RoadVision backend is running."
      );
    } finally {
      if (analysisAbortControllerRef.current === controller) {
        analysisAbortControllerRef.current = null;
      }
      setIsAnalyzing(false);
      setAnalysisProgress(0);
      setAnalysisStage("");
    }
  };

  const cancelAnalysis = () => {
    if (!isAnalyzing) {
      return;
    }

    analysisAbortControllerRef.current?.abort();
  };

  const clearInspection = () => {
    analysisAbortControllerRef.current?.abort();
    analysisAbortControllerRef.current = null;
    setIsAnalyzing(false);
    setAnalysisProgress(0);
    setAnalysisStage("");

    stopCamera();
    setShowUploadOptions(false);
    setFile(null);
    setAnalysisResult(null);
    setError("");
    setShowReport(false);
    setRoadName("");
    setLocationName("");
    setLocationSkipped(false);
    setSkipLocationRequested(false);
  };

  /* =========================
     DOWNLOAD OUTPUT
  ========================= */

  const handleDownload = async () => {
    if (!analysisResult) {
      return;
    }

    const outputPath =
      analysisResult.output_image ||
      analysisResult.output_video;

    if (!outputPath) {
      return;
    }

    const outputUrl = `${API_BASE_URL}${outputPath}`;

    try {
      const response = await fetch(outputUrl);

      if (!response.ok) {
        throw new Error("Failed to download output.");
      }

      const blob = await response.blob();

      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = blobUrl;

      const originalName =
        analysisResult.filename || "roadvision_output";

      const extension =
        outputPath.split(".").pop() || "mp4";

      const baseName =
        originalName.replace(/\.[^/.]+$/, "");

      link.download =
        `${baseName}_roadvision.${extension}`;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);

      setError(
        "Unable to download the analysis result."
      );
    }
  };

  /* =========================
     DOWNLOAD REPORT AS PDF
  ========================= */

  const generateReportPdf = () => {
    if (!analysisResult?.report) {
      return null;
    }

    const report = analysisResult.report;
    const health = report.road_condition || {};
    const breakdown = report.damage_summary?.breakdown || {};
    const detections = report.detections || {};

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 16;

    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, pageWidth, 4, "F");

    doc.setTextColor(124, 58, 237);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("ROADVISION AI", margin, 15);

    doc.setTextColor(30, 25, 36);
    doc.setFontSize(22);
    doc.text("Inspection Report", margin, 25);

    doc.setTextColor(105, 98, 113);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      "Intelligent Rural Road Condition & Infrastructure Monitoring System",
      margin,
      31
    );

    let y = 42;

    const sectionTitle = (title) => {
      doc.setTextColor(124, 58, 237);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(title.toUpperCase(), margin, y);
      doc.setDrawColor(226, 221, 231);
      doc.line(margin, y + 3, pageWidth - margin, y + 3);
      y += 9;
    };

    const safe = (value) =>
      String(value ?? "Not specified");

    sectionTitle("Inspection Details");

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [["Field", "Details"]],
      body: [
        ["Inspection File", safe(report.inspection?.image)],
        ["Inspection Date", safe(report.inspection?.date)],
        ["Road / Route", safe(report.inspection?.road_name)],
        ["Area / Village", safe(report.inspection?.location_name)],
      ],
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 3.5,
        textColor: [40, 35, 45],
      },
      headStyles: {
        fillColor: [245, 242, 247],
        textColor: [100, 92, 108],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [250, 249, 251],
      },
    });

    y = doc.lastAutoTable.finalY + 14;

    sectionTitle("Road Condition");

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [["Health Score", "Severity", "Maintenance Priority"]],
      body: [[
        `${safe(health.health_score)} / 100`,
        safe(health.severity),
        safe(health.maintenance_priority),
      ]],
      styles: {
        font: "helvetica",
        fontSize: 10,
        cellPadding: 5,
        textColor: [40, 35, 45],
        halign: "center",
      },
      headStyles: {
        fillColor: [124, 58, 237],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
      },
    });

    y = doc.lastAutoTable.finalY + 14;

    sectionTitle("Damage Summary");

    const damageRows = Object.entries(breakdown).map(
      ([defect, count]) => [defect, String(count)]
    );

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [["Detected Defect", "Count"]],
      body: damageRows.length
        ? damageRows
        : [["No defects detected.", "0"]],
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 3.5,
        textColor: [40, 35, 45],
      },
      headStyles: {
        fillColor: [245, 242, 247],
        textColor: [100, 92, 108],
        fontStyle: "bold",
      },
    });

    y = doc.lastAutoTable.finalY + 14;

    sectionTitle("Detection Details");

    const detectionRows = Array.isArray(detections)
      ? detections.map((detection, index) => [
          String(index + 1),
          safe(detection.class),
          `${(Number(detection.confidence) * 100).toFixed(1)}%`,
        ])
      : [];

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [["#", "Detected Defect", "Confidence"]],
      body: detectionRows.length
        ? detectionRows
        : [["-", "No individual detections recorded.", "-"]],
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 3.5,
        textColor: [40, 35, 45],
      },
      headStyles: {
        fillColor: [245, 242, 247],
        textColor: [100, 92, 108],
        fontStyle: "bold",
      },
    });

    y = doc.lastAutoTable.finalY + 14;

    sectionTitle("AI Recommendation");

    const recommendation = safe(
      report.recommendation || "Further inspection recommended."
    );

    doc.setFillColor(255, 247, 240);
    doc.setDrawColor(242, 139, 69);
    doc.setLineWidth(1);
    doc.rect(margin, y, pageWidth - margin * 2, 22, "FD");

    doc.setTextColor(160, 76, 19);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("MAINTENANCE GUIDANCE", margin + 5, y + 7);

    doc.setTextColor(62, 52, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    const recommendationLines = doc.splitTextToSize(
      recommendation,
      pageWidth - margin * 2 - 10
    );

    doc.text(recommendationLines, margin + 5, y + 13);

    const pageCount = doc.getNumberOfPages();

    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);

      doc.setDrawColor(228, 223, 231);
      doc.line(
        margin,
        285,
        pageWidth - margin,
        285
      );

      doc.setTextColor(129, 123, 133);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);

      doc.text(
        "Generated automatically by RoadVision AI · Prototype System",
        pageWidth / 2,
        290,
        { align: "center" }
      );
    }

    const originalName =
      report.inspection?.image ||
      "roadvision_inspection";

    const baseName =
      originalName.replace(/\.[^/.]+$/, "");

    return {
      blob: doc.output("blob"),
      filename: `${baseName}_roadvision_report.pdf`,
    };
  };

  /* =========================
     DOWNLOAD REPORT AS PDF
  ========================= */

  const handleReportDownload = () => {
    try {
      const pdf = generateReportPdf();

      if (!pdf) {
        return;
      }

      const blobUrl = URL.createObjectURL(pdf.blob);
      const link = document.createElement("a");

      link.href = blobUrl;
      link.download = pdf.filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("PDF report download failed:", error);

      setError(
        "Unable to generate the PDF inspection report."
      );
    }
  };

  /* =========================
     SHARE PDF REPORT
  ========================= */

  const handleReportShare = async () => {
    try {
      const pdf = generateReportPdf();

      if (!pdf) {
        return;
      }

      const pdfFile = new File(
        [pdf.blob],
        pdf.filename,
        { type: "application/pdf" }
      );

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [pdfFile] })
      ) {
        await navigator.share({
          title: "RoadVision AI Inspection Report",
          text: `${SHARE_DESCRIPTION}

Inspection report: ${
            analysisResult.report.inspection?.image ||
            "road inspection"
          }

RoadVision AI generated inspection report.`,
          files: [pdfFile],
        });

        return;
      }

      if (navigator.clipboard) {
        const blobUrl = URL.createObjectURL(pdf.blob);

        await navigator.clipboard.writeText(
          `${SHARE_DESCRIPTION}

RoadVision AI generated this inspection report. Use Download Report to save the PDF file.`
        );

        URL.revokeObjectURL(blobUrl);

        alert(
          "Direct PDF sharing is not supported by this browser. The report is ready to download."
        );

        return;
      }

      alert(
        "Direct PDF sharing is not supported by this browser. Please use Download Report."
      );
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }

      console.error("PDF report share failed:", error);

      setError(
        "Unable to share the PDF inspection report."
      );
    }
  };

  /* =========================
     SHARE OUTPUT
  ========================= */

  const handleShare = async () => {
    if (!analysisResult) {
      return;
    }

    const outputPath =
      analysisResult.output_image ||
      analysisResult.output_video;

    if (!outputPath) {
      return;
    }

    const outputUrl = `${API_BASE_URL}${outputPath}`;

    const shareText = `${SHARE_DESCRIPTION}

Inspection: ${
      analysisResult.filename || "Road inspection"
    }

View the analyzed road inspection result:`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "RoadVision AI Inspection Result",
          text: shareText,
          url: outputUrl,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(
          `${shareText}
${outputUrl}`
        );

        alert(
          "Analysis link and description copied."
        );
      } else {
        alert(
          "Sharing is not supported by this browser."
        );
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error(
          "Share failed:",
          error
        );
      }
    }
  };


  const handlePublicShare = async () => {
    const inspectionId = analysisResult?.inspection_id;

    if (!inspectionId) {
      setError("Public inspection link is not available for this result.");
      return;
    }

    const publicUrl = `${window.location.origin}/analysis/${inspectionId}`;

    const shareText = `${SHARE_DESCRIPTION}

Inspection: ${
      analysisResult.filename || "road inspection"
    }

View the complete inspection analysis:`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "RoadVision AI Inspection",
          text: shareText,
          url: publicUrl,
        });
        return;
      }

      await navigator.clipboard?.writeText(
        `${shareText}
${publicUrl}`
      );
      alert("Public inspection link copied.");
    } catch (shareError) {
      if (shareError?.name !== "AbortError") {
        console.error("Public share failed:", shareError);
      }
    }
  };

  /* =========================
     INSPECTION ANALYTICS
  ========================= */

  const totalInspections = analysisHistory.length;

  const averageHealthScore =
    totalInspections > 0
      ? Math.round(
          analysisHistory.reduce(
            (total, inspection) =>
              total + Number(inspection.score || 0),
            0
          ) / totalInspections
        )
      : 0;

  const severityCounts = {
    Good: analysisHistory.filter(
      (inspection) => inspection.severity === "Good"
    ).length,

    Moderate: analysisHistory.filter(
      (inspection) => inspection.severity === "Moderate"
    ).length,

    Poor: analysisHistory.filter(
      (inspection) => inspection.severity === "Poor"
    ).length,

    Critical: analysisHistory.filter(
      (inspection) => inspection.severity === "Critical"
    ).length,
  };

  const defectTotals = analysisHistory.reduce(
    (totals, inspection) => {
      Object.entries(
        inspection.damageBreakdown || {}
      ).forEach(([defect, count]) => {
        totals[defect] =
          (totals[defect] || 0) + Number(count || 0);
      });

      return totals;
    },
    {}
  );

  const mostDetectedDefect =
    Object.entries(defectTotals).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] || "No data";

  const getScoreClass = (score) => {
    if (score >= 80) {
      return "score-good";
    }

    if (score >= 60) {
      return "score-moderate";
    }

    if (score >= 40) {
      return "score-poor";
    }

    return "score-critical";
  };

  const getSeverityClass = (severity) => {
    return severity?.toLowerCase() || "moderate";
  };

  if (publicPathMatch) {
    return <PublicAnalysisPage inspectionId={publicPathMatch[1]} />;
  }

  return (
    <div className="app">

      {/* =========================
          TOP BAR
      ========================= */}

      <header className="topbar">
        <div className="brand">

          <div className="brand-icon logo-image-wrap">
            <img
              src="/roadvision-logo.png"
              alt="RoadVision AI"
              className="roadvision-logo"
            />
          </div>

          <div className="brand-copy">
            <h1>RoadVision AI</h1>
            <span>
              Intelligent Road Monitoring
            </span>
          </div>

        </div>

        <div className="system-status">
          <span className="status-dot" />
          <span>AI System Ready</span>
        </div>
      </header>


      <main className="dashboard">

        {/* =========================
            HERO
        ========================= */}

        <section className="hero">

          <div
            className="hero-road"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 900 430"
              preserveAspectRatio="xMidYMid slice"
            >

              <defs>

                <linearGradient
                  id="roadSky"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#10151d"
                    stopOpacity="0.15"
                  />

                  <stop
                    offset="55%"
                    stopColor="#090c11"
                    stopOpacity="0.35"
                  />

                  <stop
                    offset="100%"
                    stopColor="#050609"
                    stopOpacity="0.95"
                  />
                </linearGradient>

                <linearGradient
                  id="roadSurface"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#25272a"
                  />

                  <stop
                    offset="35%"
                    stopColor="#15171a"
                  />

                  <stop
                    offset="100%"
                    stopColor="#08090b"
                  />
                </linearGradient>

                <linearGradient
                  id="roadGlow"
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                >
                  <stop
                    offset="0%"
                    stopColor="#ff7b25"
                    stopOpacity="0"
                  />

                  <stop
                    offset="50%"
                    stopColor="#ff8a3d"
                    stopOpacity="0.55"
                  />

                  <stop
                    offset="100%"
                    stopColor="#ff7b25"
                    stopOpacity="0"
                  />
                </linearGradient>

                <filter id="softGlow">
                  <feGaussianBlur stdDeviation="7" />
                </filter>

                <filter id="roadBlur">
                  <feGaussianBlur stdDeviation="1.5" />
                </filter>

              </defs>

              <rect
                width="900"
                height="430"
                fill="url(#roadSky)"
              />

              <ellipse
                cx="650"
                cy="175"
                rx="230"
                ry="75"
                fill="#ff7628"
                opacity="0.09"
                filter="url(#softGlow)"
              />

              <path
                d="M420 165 L520 165 L900 430 L0 430 Z"
                fill="url(#roadSurface)"
              />

              <path
                d="M420 165 L390 165 L0 430 L42 430 Z"
                fill="#0d0f12"
              />

              <path
                d="M520 165 L548 165 L900 430 L858 430 Z"
                fill="#0d0f12"
              />

              <path
                d="M420 166 L40 430"
                fill="none"
                stroke="#d8d9d7"
                strokeWidth="3"
                opacity="0.42"
              />

              <path
                d="M520 166 L860 430"
                fill="none"
                stroke="#d8d9d7"
                strokeWidth="3"
                opacity="0.42"
              />

              <path
                d="M470 166 L465 195"
                stroke="#f5c45b"
                strokeWidth="4"
                opacity="0.8"
              />

              <path
                d="M465 215 L455 250"
                stroke="#f5c45b"
                strokeWidth="6"
                opacity="0.75"
              />

              <path
                d="M450 275 L430 330"
                stroke="#f5c45b"
                strokeWidth="8"
                opacity="0.65"
              />

              <path
                d="M420 360 L390 430"
                stroke="#f5c45b"
                strokeWidth="11"
                opacity="0.48"
              />

              <path
                d="M250 390 L650 390"
                stroke="#ffffff"
                strokeWidth="1"
                opacity="0.035"
              />

              <path
                d="M190 410 L710 410"
                stroke="#ffffff"
                strokeWidth="1"
                opacity="0.025"
              />

              <path
                d="M470 175 C570 205 690 265 835 420"
                fill="none"
                stroke="url(#roadGlow)"
                strokeWidth="16"
                opacity="0.22"
                filter="url(#softGlow)"
              />

              <path
                d="M470 175 C570 205 690 265 835 420"
                fill="none"
                stroke="#ff8a3d"
                strokeWidth="2"
                opacity="0.38"
                filter="url(#roadBlur)"
              />

              <circle
                cx="455"
                cy="174"
                r="2"
                fill="#ffb15c"
                opacity="0.8"
              />

              <circle
                cx="487"
                cy="174"
                r="2"
                fill="#ffb15c"
                opacity="0.65"
              />

              <rect
                x="0"
                y="0"
                width="900"
                height="430"
                fill="url(#roadSky)"
              />

            </svg>
          </div>


          <div className="hero-content">

            <div className="eyebrow">
              <span className="eyebrow-line" />
              AI-POWERED ROAD INSPECTION
            </div>

            <h2>
              Smarter roads.
              <br />
              <span>Better decisions.</span>
            </h2>

            <p>
              Detect road defects, assess road health,
              and generate actionable inspection insights
              using AI-powered computer vision.
            </p>

            <div className="hero-meta">

              <div>
                <ShieldCheck size={16} />
                <span>YOLO V4 Engine</span>
              </div>

              <div>
                <ScanLine size={16} />
                <span>5 Defect Classes</span>
              </div>

              <div>
                <FileText size={16} />
                <span>Automated Analysis</span>
              </div>

            </div>

          </div>


          <div className="hero-engine">

            <div className="engine-glow" />

            <div className="engine-icon">
              <Activity size={32} />
            </div>

            <div>
              <span>DETECTION ENGINE</span>
              <strong>RoadVision V4</strong>
              <small>
                AI inspection ready
              </small>
            </div>

            <ArrowUpRight
              className="engine-arrow"
              size={20}
            />

          </div>

        </section>


        {/* =========================
            UPLOAD
        ========================= */}

        <section className="inspection-section" id="new-inspection">

          <div className="section-heading">

            <div>

              <span className="section-label">
                01 / NEW INSPECTION
              </span>

              <h3>
                Upload Road Media
              </h3>

            </div>

            <span className="supported">
              JPG · PNG · WEBP · MP4 · AVI · MOV
            </span>

          </div>


          <div className="upload-layout">

            <div
              className="upload-box"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const droppedFile = event.dataTransfer.files?.[0];

                if (droppedFile) {
                  setFile(droppedFile);
                  setAnalysisResult(null);
                  setError("");
                }
              }}
            >

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              <motion.div
                className="upload-icon"
                whileHover={{
                  scale: 1.08,
                  rotate: 2,
                }}
                transition={{
                  duration: 0.2,
                }}
              >
                <Upload size={28} />
              </motion.div>

              <h4>
                {file
                  ? file.name
                  : "Drop road media here"}
              </h4>

              <p>
                {file
                  ? isImage
                    ? "Image selected and ready for AI inspection"
                    : "Video selected and ready for AI inspection"
                  : "Drag & drop your file or browse from your device"}
              </p>

              <button
                type="button"
                className="browse-button"
                onClick={() => setShowUploadOptions(true)}
              >
                {file ? "Change File" : "Browse Files"}
              </button>

            </div>

            {showUploadOptions &&
              createPortal(
                <div
                  className="upload-options-overlay"
                  onClick={() => setShowUploadOptions(false)}
                >
                  <motion.div
                  className="upload-options-modal"
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="upload-options-header">
                    <div>
                      <span className="section-label">ROADVISION AI</span>
                      <h4>Choose Media Source</h4>
                      <p>Select how you want to provide road media.</p>
                    </div>

                    <button
                      type="button"
                      className="upload-options-close"
                      onClick={() => setShowUploadOptions(false)}
                      aria-label="Close media source dialog"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="upload-options-grid">
                    <button
                      type="button"
                      className="upload-option-card"
                      onClick={openCamera}
                    >
                      <span className="upload-option-icon">
                        <Camera size={24} />
                      </span>
                      <strong>Camera</strong>
                      <span>Take a road photo</span>
                    </button>

                    <button
                      type="button"
                      className="upload-option-card"
                      onClick={openFilePicker}
                    >
                      <span className="upload-option-icon">
                        <Upload size={24} />
                      </span>
                      <strong>Files</strong>
                      <span>Choose image or video</span>
                    </button>
                  </div>

                  <div className="upload-options-supported">
                    <span>SUPPORTED</span>
                    JPG · PNG · WEBP · MP4 · AVI · MOV
                  </div>

                  <button
                    type="button"
                    className="upload-options-cancel"
                    onClick={() => setShowUploadOptions(false)}
                  >
                    Cancel
                  </button>
                  </motion.div>
                </div>,
                document.body
              )}


            {showCamera &&
              createPortal(
                <div
                  className="camera-overlay"
                  onClick={() => {
                    if (!isRecording) {
                      stopCamera();
                    }
                  }}
                >
                  <motion.div
                    className="camera-modal"
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="camera-header">
                      <div>
                        <span className="section-label">ROADVISION AI</span>
                        <h4>
                          {cameraMode === "image"
                            ? "Capture Road Photo"
                            : "Record Road Video"}
                        </h4>
                        <p>
                          {cameraMode === "image"
                            ? "Position the road inside the frame and take a photo."
                            : "Record up to 60 seconds or 500 MB. The video will not be analyzed automatically."}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="upload-options-close"
                        onClick={stopCamera}
                        disabled={isRecording}
                        aria-label="Close camera"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="camera-mode-switch">
                      <button
                        type="button"
                        className={cameraMode === "image" ? "active" : ""}
                        onClick={() => selectCameraMode("image")}
                        disabled={isRecording}
                      >
                        <Camera size={16} />
                        Image
                      </button>

                      <button
                        type="button"
                        className={cameraMode === "video" ? "active" : ""}
                        onClick={() => selectCameraMode("video")}
                        disabled={isRecording}
                      >
                        <Video size={16} />
                        Video
                      </button>
                    </div>

                    <div className="camera-preview">
                      <video
                        ref={cameraVideoRef}
                        autoPlay
                        muted
                        playsInline
                      />
                      <div className="camera-frame" aria-hidden="true" />

                      {cameraMode === "video" && isRecording && (
                        <div className="camera-recording-indicator">
                          <span />
                          REC · {recordingSeconds}s / 60s
                          <small>
                            {(recordingSize / (1024 * 1024)).toFixed(1)} MB / 500 MB
                          </small>
                        </div>
                      )}
                    </div>

                    {cameraMode === "video" && !isRecording && (
                      <div className="camera-limit-note">
                        <span>MAXIMUM RECORDING</span>
                        <strong>60 seconds · 500 MB</strong>
                      </div>
                    )}

                    <div className="camera-actions">
                      <button
                        type="button"
                        className="upload-options-cancel"
                        onClick={isRecording ? cancelRecording : stopCamera}
                      >
                        {isRecording ? "Discard Recording" : "Cancel"}
                      </button>

                      {cameraMode === "image" ? (
                        <button
                          type="button"
                          className="camera-capture-button"
                          onClick={captureCameraPhoto}
                        >
                          <Camera size={19} />
                          Take Photo
                        </button>
                      ) : isRecording ? (
                        <button
                          type="button"
                          className="camera-capture-button recording"
                          onClick={() => stopRecording("manual")}
                        >
                          <X size={19} />
                          Stop Recording
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="camera-capture-button"
                          onClick={startRecording}
                        >
                          <Video size={19} />
                          Start Recording
                        </button>
                      )}
                    </div>
                  </motion.div>
                </div>,
                document.body
              )}

            {file && (
              <motion.div
                className="selected-file"
                role="button"
                tabIndex={0}
                onClick={openSelectedMedia}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openSelectedMedia();
                  }
                }}
                title="Open original media"
                initial={{
                  opacity: 0,
                  x: 15,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
              >

                <div className="selected-file-icon">
                  {isImage ? (
                    <ImageIcon size={20} />
                  ) : (
                    <Video size={20} />
                  )}
                </div>

                <div className="selected-file-info">

                  <span>
                    SELECTED MEDIA
                  </span>

                  <strong>
                    {file.name}
                  </strong>

                  <small>
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </small>

                </div>

                <button
                  className="clear-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    clearInspection();
                  }}
                  type="button"
                  aria-label="Clear selected file"
                >
                  <X size={17} />
                </button>

              </motion.div>
            )}

          </div>


          {file && isImage && (
            <motion.div
              className="analyze-button"
              onClick={!isAnalyzing ? handleImageAnalysis : undefined}
              role="button"
              tabIndex={isAnalyzing ? -1 : 0}
              aria-disabled={isAnalyzing}
              onKeyDown={(event) => {
                if (
                  !isAnalyzing &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  event.preventDefault();
                  handleImageAnalysis();
                }
              }}
              whileHover={
                !isAnalyzing
                  ? { y: -2 }
                  : {}
              }
              whileTap={
                !isAnalyzing
                  ? { scale: 0.98 }
                  : {}
              }
            >

              {isAnalyzing ? (
                <>
                  <div className="analysis-progress-content">
                    <div className="analysis-progress-top">
                      <span className="spinner" />
                      <span>{analysisStage || "Running AI Inspection..."}</span>
                      <strong>{analysisProgress}%</strong>
                    </div>

                    <div
                      className="analysis-progress-track"
                      role="progressbar"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      aria-valuenow={analysisProgress}
                      aria-label="Image analysis progress"
                    >
                      <div
                        className="analysis-progress-fill"
                        style={{ width: `${analysisProgress}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="analysis-cancel-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      cancelAnalysis();
                    }}
                    aria-label="Cancel image analysis"
                  >
                    <X size={16} />
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <ScanLine size={19} />
                  Analyze Image
                  <ArrowUpRight size={18} />
                </>
              )}

            </motion.div>
          )}


          {file && isVideo && (
            <motion.div
              className="analyze-button"
              onClick={!isAnalyzing ? handleVideoAnalysis : undefined}
              role="button"
              tabIndex={isAnalyzing ? -1 : 0}
              aria-disabled={isAnalyzing}
              onKeyDown={(event) => {
                if (
                  !isAnalyzing &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  event.preventDefault();
                  handleVideoAnalysis();
                }
              }}
              whileHover={
                !isAnalyzing
                  ? { y: -2 }
                  : {}
              }
              whileTap={
                !isAnalyzing
                  ? { scale: 0.98 }
                  : {}
              }
            >

              {isAnalyzing ? (
                <>
                  <div className="analysis-progress-content">
                    <div className="analysis-progress-top">
                      <span className="spinner" />
                      <span>{analysisStage || "Processing Video..."}</span>
                      <strong>{analysisProgress}%</strong>
                    </div>

                    <div
                      className="analysis-progress-track"
                      role="progressbar"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      aria-valuenow={analysisProgress}
                      aria-label="Video analysis progress"
                    >
                      <div
                        className="analysis-progress-fill"
                        style={{ width: `${analysisProgress}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="analysis-cancel-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      cancelAnalysis();
                    }}
                    aria-label="Cancel video analysis"
                  >
                    <X size={16} />
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <Video size={19} />
                  Analyze Video
                  <ArrowUpRight size={18} />
                </>
              )}

            </motion.div>
          )}


          {error && (
            <motion.div
              className="error-message"
              initial={{
                opacity: 0,
                y: -5,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
            >
              <AlertTriangle size={18} />
              <span>{error}</span>
            </motion.div>
          )}

        </section>
        {/* =========================
            INSPECTION LOCATION
        ========================= */}

        {!locationSkipped && (
          <motion.section
            className={`location-section ${isAnalyzing ? "location-locked" : ""}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="section-heading">
              <div>
                <span className="section-label">
                  01 / NEW INSPECTION · LOCATION
                </span>

                <h3>Inspection Location</h3>

                <p>
                  Add the road and area where this inspection was performed.
                </p>
              </div>

              <MapPinned size={20} />
            </div>

            <div className="location-card">
              <div className="location-field">
                <label>ROAD / ROUTE</label>

                <input
                  type="text"
                  value={roadName}
                  disabled={isAnalyzing}
                  onChange={(event) =>
                    setRoadName(event.target.value)
                  }
                  placeholder="e.g. NH Road, Village Road"
                />
              </div>

              <div className="location-field">
                <label>AREA / VILLAGE *</label>

                <input
                  type="text"
                  value={locationName}
                  disabled={isAnalyzing}
                  onChange={(event) =>
                    setLocationName(event.target.value)
                  }
                  placeholder="e.g. Example Village, Odisha"
                />
              </div>
            </div>

            <div className="location-bypass">
              <label className="location-bypass-option">
                <input
                  type="checkbox"
                  checked={skipLocationRequested}
                  disabled={isAnalyzing}
                  onChange={(event) => {
                    if (isAnalyzing) return;
                    setSkipLocationRequested(event.target.checked);
                    setError("");
                  }}
                />

                <span>
                  I don't know the road or location
                </span>
              </label>

              <button
                type="button"
                className="location-bypass-button"
                disabled={isAnalyzing || !skipLocationRequested}
                onClick={() => {
                  if (isAnalyzing) return;
                  setLocationSkipped(true);
                  setRoadName("");
                  setLocationName("");
                  setSkipLocationRequested(false);
                  setError("");
                }}
              >
                Continue without location
              </button>
            </div>
          </motion.section>
        )}

        {locationSkipped && (
          <motion.div
            className={`location-skipped-card ${isAnalyzing ? "location-locked" : ""}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="location-skipped-info">
              <MapPin size={18} />
              <div>
                <strong>Location skipped</strong>
                <span>You can add the inspection location before analysis.</span>
              </div>
            </div>

            <button
              type="button"
              className="location-use-button"
              disabled={isAnalyzing}
              onClick={() => {
                if (isAnalyzing) return;
                setLocationSkipped(false);
                setSkipLocationRequested(false);
                setError("");
              }}
            >
              <MapPinned size={16} />
              Use Location
            </button>
          </motion.div>
        )}

        {/* =========================
            SYSTEM MODULES
        ========================= */}

        <section className="modules-grid">

          <motion.div
            className="module-card"
            whileHover={{ y: -4 }}
          >

            <div className="module-icon">
              <Camera size={20} />
            </div>

            <div className="module-content">
              <span>IMAGE ANALYSIS</span>
              <strong>YOLO V4</strong>
            </div>

            <CheckCircle2
              className="module-check"
              size={18}
            />

          </motion.div>


          <motion.div
            className="module-card"
            whileHover={{ y: -4 }}
          >

            <div className="module-icon">
              <Video size={20} />
            </div>

            <div className="module-content">
              <span>VIDEO TRACKING</span>
              <strong>ByteTrack</strong>
            </div>

            <CheckCircle2
              className="module-check"
              size={18}
            />

          </motion.div>


          <motion.div
            className="module-card"
            whileHover={{ y: -4 }}
          >

            <div className="module-icon">
              <Activity size={20} />
            </div>

            <div className="module-content">
              <span>HEALTH ASSESSMENT</span>
              <strong>AI Score</strong>
            </div>

            <CheckCircle2
              className="module-check"
              size={18}
            />

          </motion.div>


          <motion.div
            className="module-card"
            whileHover={{ y: -4 }}
          >

            <div className="module-icon">
              <FileText size={20} />
            </div>

            <div className="module-content">
              <span>REPORTING</span>
              <strong>Automated</strong>
            </div>

            <CheckCircle2
              className="module-check"
              size={18}
            />

          </motion.div>

        </section>


        {/* =========================
            RESULTS
        ========================= */}

        <section className="results-section">

          <div className="section-heading result-heading">

            <div>

              <span className="section-label">
                02 / INSPECTION RESULTS
              </span>

              <h3>
                Road Analysis
              </h3>

            </div>

            {analysisResult && (
              <span className="result-status">
                <span />
                ANALYSIS COMPLETE
              </span>
            )}

          </div>


          {!analysisResult &&
            !isAnalyzing && (
              <div className="empty-result">

                <div className="empty-icon">
                  <ScanLine size={28} />
                </div>

                <h4>
                  Ready for inspection
                </h4>

                <p>
                  Upload a road image or video above
                  and run an AI inspection to see
                  detected defects and road health.
                </p>

              </div>
            )}


          {isAnalyzing && (
            <div className="empty-result analyzing">

              <div className="analysis-loader">
                <span />
                <span />
                <span />
              </div>

              <h4>
                {analysisStage || "Analyzing road condition"}
              </h4>

              <div
                className="results-analysis-progress"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={analysisProgress}
                aria-label="Road analysis progress"
              >
                <div className="results-analysis-progress-top">
                  <span>AI inspection progress</span>
                  <strong>{analysisProgress}%</strong>
                </div>

                <div className="results-analysis-progress-track">
                  <div
                    className="results-analysis-progress-fill"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
              </div>

              <p>
                RoadVision V4 is detecting and
                classifying road defects...
              </p>

            </div>
          )}


          {analysisResult &&
            !isAnalyzing && (

              <motion.div
                className="results-container"
                initial={{
                  opacity: 0,
                  y: 15,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.4,
                }}
              >

                {/* =========================
                    MEDIA + HEALTH
                ========================= */}

                <div className="main-result-grid">

                  <div className="media-card">

                    <div className="card-top">

                      <div>

                        <span>
                          ANNOTATED MEDIA
                        </span>

                        <strong>
                          {analysisResult.filename}
                        </strong>

                      </div>


                      <div className="media-actions">

                        {/* DOWNLOAD */}

                        <button
                          className="media-action-button"
                          type="button"
                          onClick={handleDownload}
                          title="Download annotated output"
                        >
                          <Download size={15} />
                          <span>
                            Download
                          </span>
                        </button>


                        {/* SHARE */}

                        <button
                          className="media-action-button"
                          type="button"
                          onClick={handleShare}
                          title="Share inspection result"
                        >
                          <Share2 size={15} />
                          <span>
                            Share
                          </span>
                        </button>
                        <button
  className="media-action-button"
  type="button"
  onClick={() => setShowReport(true)}
  title="View full inspection report"
>
  <ClipboardList size={15} />
  <span>Report</span>
</button>

                        <button
                          className="media-action-button public-share-media-button"
                          type="button"
                          onClick={handlePublicShare}
                          title="Share public inspection page"
                        >
                          <Share2 size={15} />
                          <span>Public Link</span>
                        </button>


                        {/* VERSION */}

                        <div className="media-badge">
                          <ScanLine size={15} />
                          V4 DETECTION
                        </div>

                      </div>

                    </div>


                    <div className="image-wrapper">

                      {analysisResult.output_image ? (

                        <img
                          src={`${API_BASE_URL}${analysisResult.output_image}`}
                          alt="RoadVision AI annotated road analysis"
                        />

                      ) : analysisResult.output_video ? (

                        <video
                          src={`${API_BASE_URL}${analysisResult.output_video}`}
                          controls
                          playsInline
                          className="result-video"
                        >
                          Your browser does not support
                          video playback.
                        </video>

                      ) : null}

                    </div>

                  </div>


                  {/* =========================
                      HEALTH
                  ========================= */}

                  <div className="health-card">

                    <div className="card-top">

                      <div>

                        <span>
                          ROAD HEALTH
                        </span>

                        <strong>
                          AI Condition Assessment
                        </strong>

                      </div>

                    </div>


                    <div
                      className={`score-ring ${getScoreClass(
                        analysisResult.health.score
                      )}`}
                      style={{
                        "--score":
                          `${analysisResult.health.score * 3.6}deg`,
                      }}
                    >

                      <div className="score-inner">

                        <strong>
                          {analysisResult.health.score}
                        </strong>

                        <span>
                          / 100
                        </span>

                      </div>

                    </div>


                    <div
                      className={`severity-badge ${getSeverityClass(
                        analysisResult.health.severity
                      )}`}
                    >
                      <span />

                      {analysisResult.health.severity}

                    </div>


                    <p className="health-interpretation">

                      {analysisResult.health.severity ===
                      "Good"

                        ? "Road condition is generally good and requires low maintenance priority."

                        : analysisResult.health.severity ===
                          "Moderate"

                        ? "Road condition requires planned inspection and maintenance."

                        : analysisResult.health.severity ===
                          "Poor"

                        ? "Road condition requires high-priority inspection and maintenance."

                        : "Road condition requires critical attention and immediate inspection."}

                    </p>


                    <div className="health-stats">

                      <div>

                        <span>
                          Maintenance Priority
                        </span>

                        <strong>
                          {analysisResult.health.priority}
                        </strong>

                      </div>


                      <div>

                        <span>
                          Total Defects
                        </span>

                        <strong>
                          {analysisResult.health.damage_count}
                        </strong>

                      </div>

                    </div>


                    <div className="penalty-row">

                      <span>
                        AI damage penalty
                      </span>

                      <strong>
                        -{analysisResult.health.penalty}
                      </strong>

                    </div>

                  </div>

                </div>


                {/* =========================
                    DEFECT BREAKDOWN
                ========================= */}

                <div className="breakdown-card">

                  <div className="breakdown-header">

                    <div>

                      <span>
                        DEFECT BREAKDOWN
                      </span>

                      <strong>
                        Detected road condition issues
                      </strong>

                    </div>


                    <div className="defect-total">

                      <strong>
                        {analysisResult.health.damage_count}
                      </strong>

                      <span>
                        Total
                      </span>

                    </div>

                  </div>


                  <div className="defect-grid">

                    {Object.entries(
                      analysisResult.health.damage_breakdown
                    ).map(
                      ([damage, count]) => {

                        const total =
                          analysisResult.health.damage_count;

                        const percentage =
                          total > 0
                            ? Math.round(
                                (count / total) * 100
                              )
                            : 0;

                        return (

                          <motion.div
                            className="defect-card"
                            key={damage}
                            whileHover={{
                              y: -3,
                            }}
                          >

                            <div className="defect-number">
                              {count}
                            </div>

                            <div className="defect-info">

                              <span>
                                {damage}
                              </span>

                              <small>
                                {percentage}% of detected defects
                              </small>

                              <div className="defect-bar">

                                <div
                                  className="defect-bar-fill"
                                  style={{
                                    width:
                                      `${percentage}%`,
                                  }}
                                />

                              </div>

                            </div>

                          </motion.div>

                        );
                      }
                    )}

                  </div>

                </div>

              </motion.div>
            )}

        </section>

        {/* =========================
    INSPECTION MAP
========================= */}

<section className="map-section" id="inspection-map">

  <div className="section-heading">

    <div>

      <span className="section-label">
        03 / INSPECTION MAP
      </span>

      <h3>
        Road Inspection Location
      </h3>

      <p>
        Geographic view of the selected inspection area.
      </p>

    </div>

    <MapPin size={20} />

  </div>


  <div className="map-card">

  <div className="map-filter">
    <span>Severity:</span>

    <select
      value={mapSeverityFilter}
      onChange={(event) =>
        setMapSeverityFilter(event.target.value)
      }
    >
      <option value="All">All</option>
      <option value="Good">Good</option>
      <option value="Moderate">Moderate</option>
      <option value="Poor">Poor</option>
      <option value="Critical">Critical</option>
    </select>
    <button
  type="button"
  className="map-reset-button"
  onClick={() => {
    setIsResettingMap(true);
    setSelectedInspectionId(null);
    setMapSeverityFilter("All");

    setTimeout(() => {
      setIsResettingMap(false);
    }, 600);
  }}
  title="Reset map view"
>
  <RotateCcw
    size={14}
    className={
      isResettingMap
        ? "reset-icon-spinning"
        : ""
    }
  />
  Reset
</button>
  </div>

  <MapContainer
    key={`${mapPosition[0]}-${mapPosition[1]}`}
      center={mapPosition}
      zoom={12}
      scrollWheelZoom={false}
      className="roadvision-map"
    >
     <MapBoundsController
  inspections={filteredMapInspections}
  selectedInspectionId={selectedInspectionId}
  markerRefs={markerRefs}
/>

      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
{filteredMapInspections.length === 0 && (
  <div className="map-empty-state">
    <strong>
      No {mapSeverityFilter} inspections found
    </strong>
    <span>
      Try another severity filter.
    </span>
  </div>
)}
      {filteredMapInspections.map((inspection) => (
    <Marker
  key={inspection.id}
  ref={(marker) => {
    if (marker) {
      markerRefs.current[inspection.id] = marker;
    }
  }}
  position={[
    Number(inspection.latitude),
    Number(inspection.longitude),
  ]}
  icon={createInspectionMarkerIcon(
  inspection.severity
)}
>
      <Popup>
        <strong>RoadVision AI Inspection</strong>
        <br />
        {inspection.roadName || "Road not specified"}
        <br />
        {inspection.locationName || "Location not specified"}
        <br />
        <strong>
          Health: {inspection.score}/100
        </strong>
        <br />
        {inspection.severity} · {inspection.priority}
        <br />
        {inspection.damageCount} defect
        {inspection.damageCount === 1 ? "" : "s"}
      </Popup>
    </Marker>
  ))}

    </MapContainer>

<div className="map-legend">
  <span>SEVERITY</span>

  <div>
    <i className="legend-dot good" />
    Good
  </div>

  <div>
    <i className="legend-dot moderate" />
    Moderate
  </div>

  <div>
    <i className="legend-dot poor" />
    Poor
  </div>

  <div>
    <i className="legend-dot critical" />
    Critical
  </div>
</div>

    <div className="map-overlay-info">

      <div className="map-status-dot" />

      <div>

        <strong>
  {isGeocoding
    ? "Locating inspection..."
    : filteredMapInspections.length === 1
      ? "Inspection Point"
      : "Inspection Points"}
</strong>

        <span>
          {roadName || "Road not specified"}
          {" · "}
          {locationName || "Location not specified"}
        </span>
        <span className="map-inspection-count">
  {filteredMapInspections.length} inspection
  {filteredMapInspections.length !== 1 ? "s" : ""} shown
</span>

      </div>

    </div>

  </div>

</section>

        {/* =========================
            ANALYSIS HISTORY
        ========================= */}

        <section className="history-section" id="analysis-history">

          <div className="section-heading">

            <div>

              <span className="section-label">
                04 / ANALYSIS HISTORY
              </span>

              <h3>
                Recent Inspections
              </h3>

            </div>

            {analysisHistory.length > 0 && (
              <span className="supported">
                {analysisHistory.length} inspection
                {analysisHistory.length !== 1 ? "s" : ""}
              </span>
            )}

          </div>


          {analysisHistory.length === 0 ? (

            <div className="empty-history">

              <div className="empty-icon">
                <Activity size={25} />
              </div>

              <div>
                <h4>
                  No inspections yet
                </h4>

                <p>
                  Completed road inspections will
                  appear here automatically.
                </p>
              </div>

            </div>

          ) : (

            <div className="history-list">

              {analysisHistory.map((inspection) => (

                <motion.div
  className={`history-item ${
  selectedInspectionId === inspection.id
    ? "selected"
    : ""
}`}
  key={inspection.id}
  onClick={() => {
    if (
      inspection.latitude != null &&
      inspection.longitude != null
    ) {
      setSelectedInspectionId(inspection.id);
    }
  }}
  initial={{
    opacity: 0,
    y: 10,
  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    duration: 0.3,
                  }}
                >

                  <div className="history-type-icon">

                    {inspection.type === "Image" ? (
                      <ImageIcon size={19} />
                    ) : (
                      <Video size={19} />
                    )}

                  </div>


                  <div className="history-main">

                    <strong>
                      {inspection.filename}
                    </strong>

                    <span>
                      {inspection.type} ·{" "}
                      {inspection.timestamp}
                    </span>
                    <span className="history-location">
  <MapPin size={10} />

  {inspection.roadName || "Road not specified"}

  {inspection.locationName
    ? ` · ${inspection.locationName}`
    : ""}

 {inspection.latitude != null &&
inspection.longitude != null
  ? ` · ${Number(inspection.latitude).toFixed(4)}, ${Number(
      inspection.longitude
    ).toFixed(4)}`
  : ""}
</span>

                  </div>


                  <div
                    className={`history-score ${getScoreClass(
                      inspection.score
                    )}`}
                  >
                    <strong>
                      {inspection.score}
                    </strong>

                    <span>
                      / 100
                    </span>
                  </div>


                  <div
                    className={`history-severity ${getSeverityClass(
                      inspection.severity
                    )}`}
                  >
                    <span />

                    {inspection.severity}
                  </div>


                  <div className="history-stat">

                    <span>
                      Priority
                    </span>

                    <strong>
                      {inspection.priority}
                    </strong>

                  </div>


                  <div className="history-stat">

                    <span>
                      Defects
                    </span>

                    <strong>
                      {inspection.damageCount}
                    </strong>

                  </div>

                </motion.div>

              ))}

            </div>

          )}

        </section>


        {/* =========================
            INSPECTION ANALYTICS
        ========================= */}

        <section className="analytics-section" id="inspection-analytics">

          <div className="section-heading">

            <div>

              <span className="section-label">
                05 / INSPECTION ANALYTICS
              </span>

              <h3>
                Inspection Overview
              </h3>

            </div>

            <span className="supported">
              Based on recent inspections
            </span>

          </div>


          <div className="analytics-grid">

            <div className="analytics-card">

              <span>
                TOTAL INSPECTIONS
              </span>

              <strong>
                {totalInspections}
              </strong>

              <small>
                Recent inspections stored
              </small>

            </div>


            <div className="analytics-card">

              <span>
                AVERAGE HEALTH
              </span>

              <strong>
                {averageHealthScore}
                <em>/100</em>
              </strong>

              <small>
                Average road health score
              </small>

            </div>


            <div className="analytics-card">

              <span>
                MOST DETECTED DEFECT
              </span>

              <strong className="analytics-defect">
                {mostDetectedDefect}
              </strong>

              <small>
                Across recent inspections
              </small>

            </div>


            <div className="analytics-card severity-overview">

              <span>
                SEVERITY DISTRIBUTION
              </span>

              <div className="severity-summary">

                <div>
                  <strong>
                    {severityCounts.Good}
                  </strong>
                  <small>Good</small>
                </div>

                <div>
                  <strong>
                    {severityCounts.Moderate}
                  </strong>
                  <small>Moderate</small>
                </div>

                <div>
                  <strong>
                    {severityCounts.Poor}
                  </strong>
                  <small>Poor</small>
                </div>

                <div>
                  <strong>
                    {severityCounts.Critical}
                  </strong>
                  <small>Critical</small>
                </div>

              </div>

            </div>

          </div>

        </section>


        {/* =========================
            CAPABILITIES
        ========================= */}

        <section className="bottom-grid">

          <div className="info-card">

            <span className="section-label">
              SYSTEM CAPABILITIES
            </span>


            <div className="capability">

              <div className="capability-icon">
                <MapPin size={18} />
              </div>

              <div>

                <strong>
                  Defect Detection
                </strong>

                <span>
                  5 trained road-defect classes
                </span>

              </div>

            </div>


            <div className="capability">

              <div className="capability-icon">
                <Activity size={18} />
              </div>

              <div>

                <strong>
                  Road Health
                </strong>

                <span>
                  AI-derived condition assessment
                </span>

              </div>

            </div>


            <div className="capability">

              <div className="capability-icon">
                <FileText size={18} />
              </div>

              <div>

                <strong>
                  Automated Reports
                </strong>

                <span>
                  Inspection results in JSON format
                </span>

              </div>

            </div>

          </div>


          <div className="info-card project-card">

            <div className="project-card-icon">
              <ShieldCheck size={25} />
            </div>

            <div>

              <span className="section-label">
                ROADVISION AI
              </span>

              <h4>
                Intelligent Road Monitoring
              </h4>

              <p>
                AI-assisted inspection designed to
                help identify road defects and
                prioritize maintenance decisions.
              </p>

            </div>


            <div className="prototype-note">

              <span />

              Prototype System

            </div>

          </div>

        </section>
       
      {/* =========================
    REPORT VIEWER
========================= */}

{showReport &&
  analysisResult?.report && (
    <div
      className="report-overlay"
      onClick={() => setShowReport(false)}
    >
      <motion.div
        className="report-viewer"
        initial={{
          opacity: 0,
          y: 20,
          scale: 0.98,
        }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
        }}
        transition={{
          duration: 0.25,
        }}
        onClick={(event) => event.stopPropagation()}
      >

        {/* REPORT HEADER */}

        <div className="report-header">

          <div className="report-title">

            <div className="report-icon">
              <ClipboardList size={21} />
            </div>

            <div>
              <span className="section-label">
                ROADVISION AI
              </span>

              <h3>
                Inspection Report
              </h3>

              <p>
                {analysisResult.report.inspection.image}
              </p>
            </div>

          </div>

          <div className="report-header-actions">

            <button
              className="report-download-button"
              type="button"
              onClick={handleReportDownload}
              title="Download inspection report"
            >
              <Download size={16} />
              <span>Download Report</span>
            </button>

            <button
              className="report-share-button"
              type="button"
              onClick={handleReportShare}
              title="Share PDF inspection report"
            >
              <Share2 size={16} />
              <span>Share</span>
            </button>

            <button
              className="report-close"
              type="button"
              onClick={() => setShowReport(false)}
              title="Close report"
            >
              <X size={19} />
            </button>

          </div>

        </div>


        {/* INSPECTION DETAILS */}

        <div className="report-details-grid">

          <div className="report-detail-card">

            <span>
              INSPECTION FILE
            </span>

            <strong>
              {analysisResult.report.inspection.image}
            </strong>

          </div>

          <div className="report-detail-card">

            <span>
              INSPECTION DATE
            </span>

            <strong>
              {analysisResult.report.inspection.date}
            </strong>

          </div>
          <div className="report-detail-card">

  <span>
    ROAD / ROUTE
  </span>

  <strong>
    {analysisResult.report.inspection.road_name ||
      "Not specified"}
  </strong>

</div>

<div className="report-detail-card">

  <span>
    AREA / VILLAGE
  </span>

  <strong>
    {analysisResult.report.inspection.location_name ||
      "Not specified"}
  </strong>

</div>

          <div className="report-detail-card">

            <span>
              TOTAL DEFECTS
            </span>

            <strong>
              {analysisResult.report.damage_summary.total_defects}
            </strong>

          </div>

        </div>


        {/* ROAD CONDITION */}

        <div className="report-section">

          <div className="report-section-heading">

            <div>
              <span className="section-label">
                ROAD CONDITION
              </span>

              <h4>
                AI Health Assessment
              </h4>
            </div>

            <ShieldCheck size={19} />

          </div>


          <div className="report-health-grid">

            <div className="report-score-card">

              <span>
                HEALTH SCORE
              </span>

              <strong
                className={getScoreClass(
                  analysisResult.report.road_condition.health_score
                )}
              >
                {analysisResult.report.road_condition.health_score}
              </strong>

              <small>
                / 100
              </small>

            </div>


            <div className="report-condition-card">

              <span>
                SEVERITY
              </span>

              <div
                className={`history-severity ${getSeverityClass(
                  analysisResult.report.road_condition.severity
                )}`}
              >
                <span />
                {analysisResult.report.road_condition.severity}
              </div>

            </div>


            <div className="report-condition-card">

              <span>
                MAINTENANCE PRIORITY
              </span>

              <strong>
                {analysisResult.report.road_condition.maintenance_priority}
              </strong>

            </div>

          </div>

        </div>


        {/* DAMAGE SUMMARY */}

        <div className="report-section">

          <div className="report-section-heading">

            <div>
              <span className="section-label">
                DAMAGE SUMMARY
              </span>

              <h4>
                Detected Defects
              </h4>
            </div>

            <AlertTriangle size={19} />

          </div>


          <div className="report-breakdown">

            {Object.entries(
              analysisResult.report.damage_summary.breakdown || {}
            ).length === 0 ? (

              <div className="report-empty">
                No defects detected.
              </div>

            ) : (

              Object.entries(
  analysisResult.report.damage_summary.breakdown || {}
).map(([defect, count]) => {
  const normalizedDefect = defect.toLowerCase();

  const severityClass =
    normalizedDefect === "pothole"
      ? "defect-high"
      : normalizedDefect === "alligator crack"
        ? "defect-medium"
        : "defect-normal";

  return (
    <div
      className={`report-defect-row ${severityClass}`}
      key={defect}
    >
      <div className="report-defect-name">
        <span />
        <strong>{defect}</strong>
      </div>

      <strong>{count}</strong>
    </div>
  );
})

            )}

          </div>

        </div>


        {/* DETECTION DETAILS */}

        <div className="report-section">

          <div className="report-section-heading">

            <div>
              <span className="section-label">
                DETECTION DETAILS
              </span>

              <h4>
                AI Detection Results
              </h4>
            </div>

            <ScanLine size={19} />

          </div>


          {analysisResult.report.detections?.length > 0 ? (

            <div className="report-detections">

              {analysisResult.report.detections.map(
  (detection, index) => {
    const confidence =
      Number(detection.confidence) * 100;

    return (
      <div
        className="report-detection-row"
        key={`${detection.class}-${index}`}
      >
        <div>
          <strong>
            {detection.class}
          </strong>

          <span>
            Detection {index + 1}
          </span>

          <div className="confidence-bar">
            <div
              className="confidence-bar-fill"
              style={{
                width: `${confidence}%`,
              }}
            />
          </div>
        </div>

        <strong>
          {confidence.toFixed(1)}%
        </strong>
      </div>
    );
  }
)}
            </div>

          ) : (

            <div className="report-empty">
              No individual detections recorded.
            </div>

          )}

        </div>


        {/* RECOMMENDATION */}

        <div className="report-recommendation">

          <div className="report-recommendation-icon">
            <ArrowUpRight size={19} />
          </div>

          <div>

            <span>
              AI RECOMMENDATION
            </span>

            <p>
              {analysisResult.report.recommendation}
            </p>

          </div>

        </div>


        {/* FOOTER */}

        <div className="report-footer">

          <FileText size={15} />

          <span>
            Generated automatically by RoadVision AI
          </span>

        </div>

      </motion.div>
    </div>
  )}


        {/* =========================
            QUICK LINKS / FOOTER
        ========================= */}

        <footer className="site-footer">

          <div className="quick-links">

            <div className="quick-links-heading">
              <span className="section-label">
                QUICK LINKS
              </span>

              <p>
                Navigate through RoadVision AI
              </p>
            </div>

            <nav className="quick-links-nav" aria-label="Quick links">

              <a href="#new-inspection">
                New Inspection
              </a>

              <a href="#inspection-map">
                Inspection Map
              </a>

              <a href="#analysis-history">
                Analysis History
              </a>

              <a href="#inspection-analytics">
                Analytics
              </a>

            </nav>

          </div>


          <div className="site-footer-bottom">

            <div className="footer-brand">
              <strong>
                RoadVision AI
              </strong>

              <span>
                Intelligent Road Monitoring
              </span>
            </div>

          </div>

        </footer>

      </main>

    </div>
  );
}

export default App;
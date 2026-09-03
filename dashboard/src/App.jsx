import { useState } from "react";

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Camera,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  MapPin,
  ScanLine,
  ShieldCheck,
  Upload,
  Video,
  X,
} from "lucide-react";

import { motion } from "framer-motion";

import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000";

function App() {
  const [file, setFile] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");

  const isImage = file?.type?.startsWith("image/");
  const isVideo = file?.type?.startsWith("video/");

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);
    setAnalysisResult(null);
    setError("");
  };

  const handleImageAnalysis = async () => {
    if (!file || !isImage) {
      return;
    }

    setIsAnalyzing(true);
    setError("");
    setAnalysisResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${API_BASE_URL}/api/analyze/image`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error("Image analysis failed.");
      }

      const data = await response.json();

      setAnalysisResult(data);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to analyze the image. Make sure the RoadVision backend is running."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleVideoAnalysis = async () => {
    if (!file || !isVideo) {
      return;
    }

    setIsAnalyzing(true);
    setError("");
    setAnalysisResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${API_BASE_URL}/api/analyze/video`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error("Video analysis failed.");
      }

      const data = await response.json();

      setAnalysisResult(data);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to analyze the video. Make sure the RoadVision backend is running."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearInspection = () => {
    setFile(null);
    setAnalysisResult(null);
    setError("");
  };

  const getScoreClass = (score) => {
    if (score >= 80) return "score-good";
    if (score >= 60) return "score-moderate";
    if (score >= 40) return "score-poor";
    return "score-critical";
  };

  const getSeverityClass = (severity) => {
    return severity?.toLowerCase() || "moderate";
  };

  return (
    <div className="app">
      {/* TOP BAR */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Activity size={22} />
          </div>

          <div className="brand-copy">
            <h1>RoadVision AI</h1>
            <span>Intelligent Road Monitoring</span>
          </div>
        </div>

        <div className="system-status">
          <span className="status-dot" />
          <span>AI System Ready</span>
        </div>
      </header>

      <main className="dashboard">
        {/* HERO */}
        <section className="hero">
          {/* REALISTIC ROAD VISUAL */}
          <div className="hero-road" aria-hidden="true">
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

              {/* Distant atmosphere */}
              <rect
                width="900"
                height="430"
                fill="url(#roadSky)"
              />

              {/* Horizon illumination */}
              <ellipse
                cx="650"
                cy="175"
                rx="230"
                ry="75"
                fill="#ff7628"
                opacity="0.09"
                filter="url(#softGlow)"
              />

              {/* Main asphalt road */}
              <path
                d="M420 165 L520 165 L900 430 L0 430 Z"
                fill="url(#roadSurface)"
              />

              {/* Left road shoulder */}
              <path
                d="M420 165 L390 165 L0 430 L42 430 Z"
                fill="#0d0f12"
              />

              {/* Right road shoulder */}
              <path
                d="M520 165 L548 165 L900 430 L858 430 Z"
                fill="#0d0f12"
              />

              {/* Left road edge */}
              <path
                d="M420 166 L40 430"
                fill="none"
                stroke="#d8d9d7"
                strokeWidth="3"
                opacity="0.42"
              />

              {/* Right road edge */}
              <path
                d="M520 166 L860 430"
                fill="none"
                stroke="#d8d9d7"
                strokeWidth="3"
                opacity="0.42"
              />

              {/* Center lane markings */}
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

              {/* Subtle road texture */}
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

              {/* Orange AI inspection illumination */}
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

              {/* Distant inspection lights */}
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

              {/* Foreground atmospheric fade */}
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
              Detect road defects, assess road health, and generate
              actionable inspection insights using AI-powered
              computer vision.
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
              <small>AI inspection ready</small>
            </div>

            <ArrowUpRight
              className="engine-arrow"
              size={20}
            />
          </div>
        </section>

        {/* UPLOAD */}
        <section className="inspection-section">
          <div className="section-heading">
            <div>
              <span className="section-label">
                01 / NEW INSPECTION
              </span>

              <h3>Upload Road Media</h3>
            </div>

            <span className="supported">
              JPG · PNG · WEBP · MP4 · AVI · MOV
            </span>
          </div>

          <div className="upload-layout">
            <label className="upload-box">
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
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

              <span className="browse-button">
                {file ? "Change File" : "Browse Files"}
              </span>
            </label>

            {file && (
              <motion.div
                className="selected-file"
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
                  <span>SELECTED MEDIA</span>

                  <strong>{file.name}</strong>

                  <small>
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </small>
                </div>

                <button
                  className="clear-button"
                  onClick={clearInspection}
                  type="button"
                  aria-label="Clear selected file"
                >
                  <X size={17} />
                </button>
              </motion.div>
            )}
          </div>

          {file && isImage && (
            <motion.button
              className="analyze-button"
              onClick={handleImageAnalysis}
              disabled={isAnalyzing}
              whileHover={
                !isAnalyzing ? { y: -2 } : {}
              }
              whileTap={
                !isAnalyzing ? { scale: 0.98 } : {}
              }
            >
              {isAnalyzing ? (
                <>
                  <span className="spinner" />
                  Running AI Inspection...
                </>
              ) : (
                <>
                  <ScanLine size={19} />
                  Analyze Image
                  <ArrowUpRight size={18} />
                </>
              )}
            </motion.button>
          )}

          {file && isVideo && (
            <motion.button
              className="analyze-button"
              onClick={handleVideoAnalysis}
              disabled={isAnalyzing}
              whileHover={
                !isAnalyzing ? { y: -2 } : {}
              }
              whileTap={
                !isAnalyzing ? { scale: 0.98 } : {}
              }
            >
              {isAnalyzing ? (
                <>
                  <span className="spinner" />
                  Processing Video...
                </>
              ) : (
                <>
                  <Video size={19} />
                  Analyze Video
                  <ArrowUpRight size={18} />
                </>
              )}
            </motion.button>
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

        {/* SYSTEM MODULES */}
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

        {/* RESULTS */}
        <section className="results-section">
          <div className="section-heading result-heading">
            <div>
              <span className="section-label">
                02 / INSPECTION RESULTS
              </span>

              <h3>Road Analysis</h3>
            </div>

            {analysisResult && (
              <span className="result-status">
                <span />
                ANALYSIS COMPLETE
              </span>
            )}
          </div>

          {!analysisResult && !isAnalyzing && (
            <div className="empty-result">
              <div className="empty-icon">
                <ScanLine size={28} />
              </div>

              <h4>Ready for inspection</h4>

              <p>
                Upload a road image or video above and run an
                AI inspection to see detected defects and road
                health.
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

              <h4>Analyzing road condition</h4>

              <p>
                RoadVision V4 is detecting and classifying road
                defects...
              </p>
            </div>
          )}

          {analysisResult && !isAnalyzing && (
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
              {/* MEDIA + HEALTH */}
              <div className="main-result-grid">
                <div className="media-card">
                  <div className="card-top">
                    <div>
                      <span>ANNOTATED MEDIA</span>

                      <strong>
                        {analysisResult.filename ||
                          analysisResult.video}
                      </strong>
                    </div>

                    <div className="media-badge">
                      <ScanLine size={15} />
                      V4 DETECTION
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
                        Your browser does not support video
                        playback.
                      </video>
                    ) : null}
                  </div>
                </div>

                {/* HEALTH */}
                <div className="health-card">
                  <div className="card-top">
                    <div>
                      <span>ROAD HEALTH</span>

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
                      "--score": `${
                        analysisResult.health.score * 3.6
                      }deg`,
                    }}
                  >
                    <div className="score-inner">
                      <strong>
                        {analysisResult.health.score}
                      </strong>

                      <span>/ 100</span>
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
                      <span>Maintenance Priority</span>

                      <strong>
                        {analysisResult.health.priority}
                      </strong>
                    </div>

                    <div>
                      <span>Total Defects</span>

                      <strong>
                        {analysisResult.health.damage_count}
                      </strong>
                    </div>
                  </div>

                  <div className="penalty-row">
                    <span>AI damage penalty</span>

                    <strong>
                      -{analysisResult.health.penalty}
                    </strong>
                  </div>
                </div>
              </div>

              {/* DEFECT BREAKDOWN */}
              <div className="breakdown-card">
                <div className="breakdown-header">
                  <div>
                    <span>DEFECT BREAKDOWN</span>

                    <strong>
                      Detected road condition issues
                    </strong>
                  </div>

                  <div className="defect-total">
                    <strong>
                      {analysisResult.health.damage_count}
                    </strong>

                    <span>Total</span>
                  </div>
                </div>

                <div className="defect-grid">
                  {Object.entries(
                    analysisResult.health.damage_breakdown
                  ).map(([damage, count]) => {
                    const total =
                      analysisResult.health.damage_count;

                    const percentage =
                      total > 0
                        ? Math.round((count / total) * 100)
                        : 0;

                    return (
                      <motion.div
                        className="defect-card"
                        key={damage}
                        whileHover={{ y: -3 }}
                      >
                        <div className="defect-number">
                          {count}
                        </div>

                        <div className="defect-info">
                          <span>{damage}</span>

                          <small>
                            {percentage}% of detected defects
                          </small>

                          <div className="defect-bar">
                            <div
                              className="defect-bar-fill"
                              style={{
                                width: `${percentage}%`,
                              }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </section>

        {/* CAPABILITIES */}
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
                <strong>Defect Detection</strong>

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
                <strong>Road Health</strong>

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
                <strong>Automated Reports</strong>

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

              <h4>Intelligent Road Monitoring</h4>

              <p>
                AI-assisted inspection designed to help
                identify road defects and prioritize
                maintenance decisions.
              </p>
            </div>

            <div className="prototype-note">
              <span />
              Prototype System
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
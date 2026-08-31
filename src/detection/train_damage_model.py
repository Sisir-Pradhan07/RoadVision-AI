from ultralytics import YOLO

print("Loading YOLO11n...")
model = YOLO("yolo11n.pt")

print("Starting RoadVision damage model training...")

model.train(
    data="data/processed/rdd2022_yolo/data.yaml",
    epochs=20,
    imgsz=512,
    batch=4,
    device="cpu",
    workers=2,
    project="models/detection",
    name="rdd2022_v1",
)

print("Training completed!")
from ultralytics import YOLO

print("Loading YOLO model...")

model = YOLO("yolo11n.pt")

print("Model loaded successfully!")

results = model("https://ultralytics.com/images/bus.jpg")

print("Inference completed!")

for result in results:
    print(f"Detected objects: {len(result.boxes)}")
"""Generate tiny, non-user PDF fixtures for real parser/OCR smoke tests."""

from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tests" / "fixtures"
OUT.mkdir(parents=True, exist_ok=True)

text_pdf = canvas.Canvas(str(OUT / "text-two-pages.pdf"), pagesize=(612, 792))
text_pdf.setTitle("poop translator text PDF fixture")
text_pdf.setFont("Helvetica", 22)
text_pdf.drawString(60, 690, "Hello PDF world.")
text_pdf.showPage()
text_pdf.setFont("Helvetica", 22)
text_pdf.drawString(60, 690, "The cat is on the chair.")
text_pdf.save()

image = Image.new("RGB", (1000, 340), "white")
draw = ImageDraw.Draw(image)
try:
    font = ImageFont.truetype("DejaVuSans.ttf", 85)
except OSError:
    font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 85)
draw.text((80, 100), "HELLO OCR", font=font, fill="black")
bitmap = BytesIO()
image.save(bitmap, format="PNG")
bitmap.seek(0)
scan_pdf = canvas.Canvas(str(OUT / "scan-one-page.pdf"), pagesize=(612, 792))
scan_pdf.setTitle("poop translator scanned PDF fixture")
scan_pdf.drawImage(ImageReader(bitmap), 40, 450, width=530, height=180)
scan_pdf.save()

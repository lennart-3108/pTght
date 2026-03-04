from PIL import Image, ImageDraw
import os

outdir = os.path.join(os.path.dirname(__file__), 'uploads', 'avatars')
os.makedirs(outdir, exist_ok=True)

size = 256

# --- Avatar for user 156 (Jonas Weber) - blond hair, blue shirt ---
img = Image.new('RGB', (size, size), '#2a5f4a')
draw = ImageDraw.Draw(img)

draw.ellipse([20, 20, 236, 236], fill='#3a7a62')
draw.rectangle([105, 185, 151, 230], fill='#f0d0b0')
draw.ellipse([50, 210, 206, 300], fill='#2456a0')

# Face
draw.ellipse([78, 55, 178, 178], fill='#f0d0b0')

# Blond hair
draw.ellipse([70, 38, 186, 115], fill='#c8a84e')
draw.rectangle([78, 88, 178, 108], fill='#f0d0b0')
draw.rectangle([70, 60, 82, 110], fill='#c8a84e')
draw.rectangle([174, 60, 186, 110], fill='#c8a84e')

# Forehead
draw.ellipse([85, 78, 171, 128], fill='#f0d0b0')

# Left eye
draw.ellipse([100, 110, 124, 128], fill='white')
draw.ellipse([106, 113, 120, 126], fill='#3a6e8f')
draw.ellipse([110, 116, 116, 122], fill='#1a2e3f')
draw.ellipse([112, 115, 115, 118], fill='white')

# Right eye
draw.ellipse([132, 110, 156, 128], fill='white')
draw.ellipse([138, 113, 150, 126], fill='#3a6e8f')
draw.ellipse([141, 116, 147, 122], fill='#1a2e3f')
draw.ellipse([143, 115, 146, 118], fill='white')

# Eyebrows
draw.arc([97, 101, 127, 117], start=200, end=340, fill='#a08030', width=2)
draw.arc([129, 101, 159, 117], start=200, end=340, fill='#a08030', width=2)

# Nose
draw.line([(128, 128), (126, 144)], fill='#d4b090', width=2)
draw.arc([119, 140, 137, 152], start=0, end=180, fill='#d4b090', width=1)

# Mouth
draw.arc([112, 150, 144, 170], start=10, end=170, fill='#c07060', width=2)

# Ears
draw.ellipse([72, 108, 88, 138], fill='#f0d0b0')
draw.ellipse([168, 108, 184, 138], fill='#f0d0b0')

outpath = os.path.join(outdir, '156.png')
img.save(outpath)
print(f'Avatar saved: {outpath}')

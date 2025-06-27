from PIL import Image, ImageDraw

def create_icon(size, filename):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    scale = size / 128
    
    # Background circle
    margin = int(2 * scale)
    draw.ellipse([margin, margin, size-margin, size-margin], 
                fill=(142, 36, 170), outline=(106, 27, 154), width=max(1, int(2*scale)))
    
    # Magnifying glass lens
    lens_size = int(22 * scale)
    lens_x = int(50 * scale)
    lens_y = int(50 * scale)
    draw.ellipse([lens_x-lens_size, lens_y-lens_size, lens_x+lens_size, lens_y+lens_size],
                outline=(255, 224, 130), width=max(1, int(4*scale)))
    
    # Handle
    handle_start_x = int(67 * scale)
    handle_start_y = int(67 * scale) 
    handle_end_x = int(85 * scale)
    handle_end_y = int(85 * scale)
    draw.line([handle_start_x, handle_start_y, handle_end_x, handle_end_y],
             fill=(255, 224, 130), width=max(1, int(4*scale)))
    
    # Lens highlight
    if size >= 32:
        highlight_size = int(8 * scale)
        highlight_x = int(45 * scale)
        highlight_y = int(45 * scale)
        draw.ellipse([highlight_x-highlight_size, highlight_y-highlight_size, 
                     highlight_x+highlight_size, highlight_y+highlight_size],
                    fill=(255, 255, 255, 100))
    
    img.save(filename, 'PNG')
    print(f'Created {filename}')

create_icon(16, 'icon16.png')
create_icon(48, 'icon48.png') 
create_icon(128, 'icon128.png') 
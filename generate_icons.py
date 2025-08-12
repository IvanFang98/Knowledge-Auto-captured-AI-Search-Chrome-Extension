from PIL import Image, ImageDraw

def create_icon(size, filename):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    scale = size / 128
    
    # Background circle
    margin = int(2 * scale)
    draw.ellipse([margin, margin, size-margin, size-margin], 
                fill=(240, 245, 255), outline=(160, 180, 200), width=max(1, int(3*scale)))
    
    # Simple rounded lens (circle)
    lens_size = int(30 * scale)
    lens_x = int(48 * scale)
    lens_y = int(48 * scale)
    # Thick, rounded circle for the lens
    draw.ellipse([lens_x-lens_size, lens_y-lens_size, lens_x+lens_size, lens_y+lens_size],
                outline=(25, 50, 120), width=max(1, int(12*scale)))
    
    # Simple rounded handle - just a thick curved line
    handle_start_x = int(70 * scale)
    handle_start_y = int(70 * scale) 
    handle_end_x = int(88 * scale)
    handle_end_y = int(88 * scale)
    
    # Draw a simple curved handle using a few points
    handle_width = max(1, int(12*scale))
    
    # Create a gentle curve with 3 points
    points = [
        (handle_start_x, handle_start_y),
        (handle_start_x + int(6 * scale), handle_start_y + int(6 * scale)),
        (handle_end_x, handle_end_y)
    ]
    
    # Draw the curved handle
    for i in range(len(points) - 1):
        draw.line([points[i], points[i+1]], fill=(25, 50, 120), width=handle_width)
    
    # Add small rounded caps to the handle ends - ensure they don't create tails
    cap_size = max(1, int(handle_width / 2))  # Cap size should match handle width
    draw.ellipse([handle_start_x-cap_size, handle_start_y-cap_size, 
                  handle_start_x+cap_size, handle_start_y+cap_size],
                fill=(25, 50, 120))
    draw.ellipse([handle_end_x-cap_size, handle_end_y-cap_size, 
                  handle_end_x+cap_size, handle_end_y+cap_size],
                fill=(25, 50, 120))
    
    img.save(filename, 'PNG')
    print(f'Created {filename}')

create_icon(16, 'icon16.png')
create_icon(48, 'icon48.png') 
create_icon(128, 'icon128.png') 
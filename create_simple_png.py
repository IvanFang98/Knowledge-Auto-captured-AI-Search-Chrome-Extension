import struct
import zlib

def create_simple_png(width, height, filename):
    # Create a magnifying glass icon PNG
    def pack_png_chunk(chunk_type, data):
        crc = zlib.crc32(chunk_type + data) & 0xffffffff
        return struct.pack('>I', len(data)) + chunk_type + data + struct.pack('>I', crc)
    
    # PNG signature
    png_signature = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk - image header
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr_chunk = pack_png_chunk(b'IHDR', ihdr_data)
    
    # Create simple clean magnifying glass icon (just circle outline + handle)
    image_data = b''
    center_x, center_y = width // 2, height // 2
    scale = width / 16  # Scale factor based on size
    
    # Position lens slightly up and left for better handle placement
    lens_center_x = center_x - scale * 1.2
    lens_center_y = center_y - scale * 1.2
    
    for y in range(height):
        image_data += b'\x00'  # Filter type: None
        for x in range(width):
            # Calculate distance from lens center
            dx = x - lens_center_x
            dy = y - lens_center_y
            dist_from_lens_center = (dx*dx + dy*dy) ** 0.5
            
            # Circle dimensions
            outer_radius = scale * 4.5
            inner_radius = scale * 3.5
            
            # Handle coordinates (longer diagonal from bottom-right of circle)
            handle_start_x = lens_center_x + scale * 3.0
            handle_start_y = lens_center_y + scale * 3.0
            handle_end_x = lens_center_x + scale * 8.0
            handle_end_y = lens_center_y + scale * 8.0
            
            # Handle thickness (thinner as requested)
            handle_thickness = scale * 0.8
            
            # Calculate if point is on handle
            if (handle_start_x <= x <= handle_end_x and 
                handle_start_y <= y <= handle_end_y):
                # Distance from diagonal handle line
                line_dist = abs((x - handle_start_x) - (y - handle_start_y)) / (2**0.5)
                on_handle = line_dist <= handle_thickness
            else:
                on_handle = False
            
            # Circle outline only (no fill)
            on_circle_outline = (inner_radius <= dist_from_lens_center <= outer_radius)
            
            if on_circle_outline or on_handle:
                # White for magnifying glass outline and handle
                image_data += b'\xFF\xFF\xFF'  # RGB: 255, 255, 255 (white)
            else:
                # Extension background color (from CSS gradient: #667eea to #764ba2)
                # Using the starting color #667eea (102, 126, 234)
                image_data += b'\x66\x7E\xEA'  # RGB: 102, 126, 234
    
    # IDAT chunk - compressed image data
    compressed_data = zlib.compress(image_data, 9)
    idat_chunk = pack_png_chunk(b'IDAT', compressed_data)
    
    # IEND chunk - end of file
    iend_chunk = pack_png_chunk(b'IEND', b'')
    
    # Write complete PNG file
    with open(filename, 'wb') as f:
        f.write(png_signature + ihdr_chunk + idat_chunk + iend_chunk)
    
    print(f'Created {filename} ({width}x{height}) with magnifying glass')

# Create the icon files
create_simple_png(16, 16, 'icon16.png')
create_simple_png(48, 48, 'icon48.png')
create_simple_png(128, 128, 'icon128.png') 
"""
Apple SHARP 3D Gaussian Splatting Integration
Generates 3D reconstruction from single images for enhanced depth effects
https://github.com/apple/ml-sharp
"""

import os
import sys
import json
from pathlib import Path
from PIL import Image

# Handle numpy/opencv compatibility issues with Python 3.14
try:
    import numpy as np
except ImportError:
    print("Installing numpy...")
    os.system('pip install --upgrade numpy')
    import numpy as np

try:
    import cv2
except ImportError:
    print("Installing opencv-python...")
    os.system('pip install --upgrade opencv-python-headless')
    import cv2

def setup_sharp():
    """Install and setup Apple SHARP model"""
    print("="*60)
    print("Apple SHARP 3D Gaussian Splatting")
    print("https://github.com/apple/ml-sharp")
    print("="*60)
    
    print("\n[1/3] Checking dependencies...")
    try:
        import torch
    except ImportError:
        print("Installing PyTorch...")
        os.system('pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118')
        import torch
    
    # Uninstall conflicting "sharp" package and install Apple's ml-sharp
    try:
        import sharp
        # Check if this is the wrong "sharp" package
        if not hasattr(sharp, 'SHARP') and not hasattr(sharp, '__version__'):
            print("Found conflicting 'sharp' package. Removing...")
            os.system('pip uninstall -y sharp')
            print("Installing Apple SHARP...")
            os.system('pip install git+https://github.com/apple/ml-sharp.git')
    except ImportError:
        print("Installing Apple SHARP from GitHub...")
        os.system('pip install git+https://github.com/apple/ml-sharp.git')
    
    # Try importing - adjust based on actual package structure
    try:
        from sharp import SHARP
    except ImportError:
        try:
            import sharp
            print(f"Sharp package found. Available attributes: {dir(sharp)}")
            # Try alternative imports
            if hasattr(sharp, 'model'):
                from sharp.model import SHARP
            elif hasattr(sharp, 'Sharp'):
                from sharp import Sharp as SHARP
            else:
                print("ERROR: Could not find SHARP model class")
                print("This might mean Apple SHARP has a different structure.")
                print("Please check: https://github.com/apple/ml-sharp")
                print("\nAvailable in sharp module:", dir(sharp))
                return None
        except Exception as e:
            print(f"ERROR: Could not import SHARP: {e}")
            return None
    
    print("[2/3] Checking for model checkpoint...")
    checkpoint_dir = Path("checkpoints")
    checkpoint_dir.mkdir(exist_ok=True)
    
    checkpoint_path = checkpoint_dir / "sharp_model.pth"
    if not checkpoint_path.exists():
        print("Model checkpoint not found.")
        print("SHARP may download automatically on first use,")
        print("or you may need to download manually from:")
        print("https://github.com/apple/ml-sharp/releases")
        print(f"Place it in: {checkpoint_path}")
    
    print("[3/3] Loading SHARP model...")
    import torch
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    
    # Load SHARP model (may auto-download)
    try:
        if checkpoint_path.exists():
            model = SHARP.from_pretrained(str(checkpoint_path)).to(device)
        else:
            # Try automatic download
            model = SHARP.from_pretrained().to(device)
    except Exception as e:
        print(f"Error loading SHARP model: {e}")
        print("\nPlease download model manually from:")
        print("https://github.com/apple/ml-sharp")
        return None
    
    model.eval()
    
    print(f"✓ SHARP ready on {device}")
    return {'model': model, 'device': device, 'mode': 'sharp'}

def generate_gaussians(image_path, model_dict):
    """Generate 3D Gaussian representation from image using SHARP"""
    import torch
    import torchvision.transforms as transforms
    
    model = model_dict['model']
    device = model_dict['device']
    
    # Load and preprocess image
    print(f"Loading {Path(image_path).name}...")
    image = Image.open(image_path).convert('RGB')
    original_size = image.size
    
    # Prepare input (adjust based on SHARP's expected input)
    transform = transforms.Compose([
        transforms.Resize((384, 384)),  # Adjust based on SHARP requirements
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    input_tensor = transform(image).unsqueeze(0).to(device)
    
    # Run SHARP inference
    print("Running 3D reconstruction...")
    with torch.no_grad():
        output = model(input_tensor)
    
    # Extract Gaussian parameters (adjust field names based on SHARP's actual output)
    # Expected format: positions (N, 3), colors (N, 3), scales (N, 3), rotations (N, 4), opacities (N, 1)
    try:
        positions = output['means3D'].cpu().numpy().reshape(-1, 3)
        colors = output['colors'].cpu().numpy().reshape(-1, 3)
        scales = output['scales'].cpu().numpy().reshape(-1, 3)
        rotations = output['rotations'].cpu().numpy().reshape(-1, 4)  # quaternions
        opacities = output['opacities'].cpu().numpy().reshape(-1)
    except KeyError as e:
        print(f"Warning: Unexpected output format from SHARP: {e}")
        print(f"Available keys: {output.keys()}")
        # Try alternative key names
        positions = output.get('xyz', output.get('positions', output.get('means', None)))
        colors = output.get('rgb', output.get('colors', output.get('sh', None)))
        scales = output.get('scale', output.get('scales', None))
        rotations = output.get('rot', output.get('rotations', output.get('quat', None)))
        opacities = output.get('opacity', output.get('opacities', output.get('alpha', None)))
        
        if positions is not None:
            positions = positions.cpu().numpy().reshape(-1, 3)
        if colors is not None:
            colors = colors.cpu().numpy().reshape(-1, 3)
        if scales is not None:
            scales = scales.cpu().numpy().reshape(-1, 3)
        if rotations is not None:
            rotations = rotations.cpu().numpy().reshape(-1, 4)
        if opacities is not None:
            opacities = opacities.cpu().numpy().reshape(-1)
    
    num_gaussians = len(positions) if positions is not None else 0
    
    gaussian_data = {
        'original_size': original_size,
        'num_gaussians': num_gaussians,
        'mode': 'sharp',
        'positions': positions.tolist() if positions is not None else [],
        'colors': colors.tolist() if colors is not None else [],
        'scales': scales.tolist() if scales is not None else [],
        'rotations': rotations.tolist() if rotations is not None else [],
        'opacities': opacities.tolist() if opacities is not None else []
    }
    
    print(f"Generated {num_gaussians:,} 3D Gaussians")
    return gaussian_data, positions, colors, scales, rotations, opacities

def render_depth_from_gaussians(positions, opacities, image_size):
    """Render geometric depth map from 3D Gaussians"""
    width, height = image_size
    depth_map = np.full((height, width), np.inf, dtype=np.float32)
    
    if positions is None or len(positions) == 0:
        return np.zeros((height, width), dtype=np.uint8)
    
    # Camera at origin looking down -Z axis
    camera_pos = np.array([0, 0, 5])
    
    # Project each Gaussian to image plane
    for i, pos in enumerate(positions):
        # Calculate distance from camera
        distance = np.linalg.norm(pos - camera_pos)
        
        # Perspective projection
        if pos[2] < 0:  # Behind camera
            continue
        
        x = int((pos[0] / (pos[2] + 5) + 0.5) * width)
        y = int((pos[1] / (pos[2] + 5) + 0.5) * height)
        
        if 0 <= x < width and 0 <= y < height:
            weight = opacities[i] if i < len(opacities) else 1.0
            if distance * weight < depth_map[y, x]:
                depth_map[y, x] = distance * weight
    
    # Normalize to 0-255 range (closer = lighter for shader compatibility)
    valid_depths = depth_map[depth_map != np.inf]
    if len(valid_depths) > 0:
        min_depth = valid_depths.min()
        max_depth = valid_depths.max()
        depth_map[depth_map == np.inf] = max_depth
        depth_normalized = 255 - ((depth_map - min_depth) / (max_depth - min_depth + 1e-6) * 255)
        depth_normalized = np.clip(depth_normalized, 0, 255).astype(np.uint8)
    else:
        depth_normalized = np.zeros((height, width), dtype=np.uint8)
    
    return depth_normalized

def compute_normals_from_gaussians(positions, scales, rotations, image_size):
    """Compute surface normal map from oriented Gaussians"""
    width, height = image_size
    normal_map = np.zeros((height, width, 3), dtype=np.float32)
    
    if positions is None or scales is None or rotations is None:
        # Fallback: compute from depth gradient
        print("Warning: Missing Gaussian data, using default normals")
        return (np.ones((height, width, 3)) * 127.5).astype(np.uint8)
    
    # Each Gaussian has an orientation (rotation quaternion)
    for i, (pos, scale, quat) in enumerate(zip(positions, scales, rotations)):
        # Convert quaternion to rotation matrix
        w, x, y, z = quat
        R = np.array([
            [1-2*(y**2+z**2), 2*(x*y-w*z), 2*(x*z+w*y)],
            [2*(x*y+w*z), 1-2*(x**2+z**2), 2*(y*z-w*x)],
            [2*(x*z-w*y), 2*(y*z+w*x), 1-2*(x**2+y**2)]
        ])
        
        # Get principal axis (normal direction)
        normal = R @ np.array([0, 0, 1])
        normal = normal / (np.linalg.norm(normal) + 1e-6)
        
        # Project to image
        if pos[2] < 0:
            continue
        
        px = int((pos[0] / (pos[2] + 5) + 0.5) * width)
        py = int((pos[1] / (pos[2] + 5) + 0.5) * height)
        
        if 0 <= px < width and 0 <= py < height:
            # Store normal (convert from [-1,1] to [0,255])
            normal_map[py, px] = (normal + 1.0) * 127.5
    
    # Fill holes with interpolation if scipy available
    try:
        from scipy.ndimage import binary_dilation, distance_transform_edt
        mask = np.any(normal_map > 0, axis=2)
        
        if np.any(mask):
            normal_map_filled = normal_map.copy()
            for c in range(3):
                channel = normal_map[:, :, c]
                indices = distance_transform_edt(~mask, return_distances=False, return_indices=True)
                normal_map_filled[:, :, c] = channel[tuple(indices)]
            normal_map = normal_map_filled
    except ImportError:
        print("Note: Install scipy for better normal map interpolation")
    
    return normal_map.astype(np.uint8)

def process_image(image_path, model_dict, output_dir=None):
    """Complete SHARP processing pipeline"""
    image_path = Path(image_path)
    
    if output_dir is None:
        output_dir = image_path.parent
    else:
        output_dir = Path(output_dir)
        output_dir.mkdir(exist_ok=True)
    
    base_name = image_path.stem
    
    print(f"\n{'='*60}")
    print(f"Processing: {image_path.name}")
    print(f"{'='*60}")
    
    # Generate 3D Gaussians
    gaussian_data, positions, colors, scales, rotations, opacities = generate_gaussians(
        image_path, model_dict
    )
    
    # Save Gaussian data as JSON
    json_path = output_dir / f"{base_name}_gaussians.json"
    print(f"Saving Gaussian data to {json_path.name}...")
    with open(json_path, 'w') as f:
        json.dump(gaussian_data, f, indent=2)
    
    # Render geometric depth map
    print("Rendering depth map from Gaussians...")
    image_size = gaussian_data['original_size']
    depth_map = render_depth_from_gaussians(positions, opacities, image_size)
    
    depth_path = output_dir / f"{base_name}_sharp_depth.png"
    Image.fromarray(depth_map).save(depth_path)
    print(f"✓ Saved depth map: {depth_path.name}")
    
    # Generate normal map
    print("Computing surface normals from Gaussians...")
    normal_map = compute_normals_from_gaussians(positions, scales, rotations, image_size)
    
    normal_path = output_dir / f"{base_name}_normals.png"
    Image.fromarray(normal_map).save(normal_path)
    print(f"✓ Saved normal map: {normal_path.name}")
    
    print(f"\n✓ Complete! Generated:")
    print(f"  - {json_path.name} ({gaussian_data['num_gaussians']:,} Gaussians)")
    print(f"  - {depth_path.name} (geometric depth)")
    print(f"  - {normal_path.name} (surface normals)")
    
    return gaussian_data

def batch_process(input_dir, output_dir=None):
    """Process all images in a directory"""
    input_dir = Path(input_dir)
    image_files = list(input_dir.glob("*.jpg")) + list(input_dir.glob("*.jpeg")) + list(input_dir.glob("*.png"))
    
    # Exclude generated files
    image_files = [f for f in image_files if not any(x in f.name for x in ['_depth', '_normals', '_gaussians'])]
    
    if not image_files:
        print(f"No images found in {input_dir}")
        return
    
    print(f"Found {len(image_files)} images to process")
    
    model_dict = setup_sharp()
    if model_dict is None:
        return
    
    for i, image_file in enumerate(image_files, 1):
        print(f"\n[{i}/{len(image_files)}] ", end="")
        try:
            process_image(image_file, model_dict, output_dir)
        except Exception as e:
            print(f"✗ Error processing {image_file.name}: {e}")
            import traceback
            traceback.print_exc()
            continue

def main():
    if len(sys.argv) < 2:
        print("="*60)
        print("Apple SHARP 3D Gaussian Splatting Generator")
        print("https://github.com/apple/ml-sharp")
        print("="*60)
        print("\nUsage:")
        print("  python sharp_generate.py <image_file>          # Process single image")
        print("  python sharp_generate.py <directory>           # Process all images in directory")
        print("  python sharp_generate.py <image> <output_dir>  # Specify output directory")
        print("\nOutputs:")
        print("  - *_gaussians.json    # 3D Gaussian parameters")
        print("  - *_sharp_depth.png   # Geometric depth map")
        print("  - *_normals.png       # Surface normal map")
        return
    
    input_path = Path(sys.argv[1])
    output_dir = sys.argv[2] if len(sys.argv) > 2 else None
    
    if input_path.is_dir():
        batch_process(input_path, output_dir)
    elif input_path.is_file():
        model_dict = setup_sharp()
        if model_dict is not None:
            process_image(input_path, model_dict, output_dir)
    else:
        print(f"Error: {input_path} not found")

if __name__ == "__main__":
    main()


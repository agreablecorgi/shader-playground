"""
Depth Pro Integration for Shader Playground
Generates high-quality depth maps using Apple's Depth Pro model
"""

import sys
import os
from pathlib import Path
import torch
from PIL import Image
import numpy as np

def download_model_if_needed():
    """Download Depth Pro model if not present"""
    checkpoint_path = Path("checkpoints/depth_pro.pt")
    
    if checkpoint_path.exists():
        return
    
    print("Model not found. Downloading Depth Pro checkpoint...")
    print("This is a one-time download (~5GB, may take a few minutes)")
    
    checkpoint_path.parent.mkdir(exist_ok=True)
    
    import urllib.request
    url = "https://ml-site.cdn-apple.com/models/depth-pro/depth_pro.pt"
    
    def progress_hook(count, block_size, total_size):
        percent = int(count * block_size * 100 / total_size)
        sys.stdout.write(f"\rDownloading: {percent}%")
        sys.stdout.flush()
    
    try:
        urllib.request.urlretrieve(url, str(checkpoint_path), progress_hook)
        print("\n✓ Model downloaded successfully!")
    except Exception as e:
        print(f"\n✗ Download failed: {e}")
        print("\nPlease download manually:")
        print(f"  URL: {url}")
        print(f"  Save to: {checkpoint_path}")
        sys.exit(1)

def setup_depth_pro():
    """Install and import Depth Pro"""
    # Ensure model is downloaded
    download_model_if_needed()
    
    try:
        import depth_pro
    except ImportError:
        print("Installing Depth Pro...")
        os.system(f"{sys.executable} -m pip install git+https://github.com/apple/ml-depth-pro.git")
        import depth_pro
    
    from depth_pro import create_model_and_transforms
    
    # Load model from local checkpoint
    model, transform = create_model_and_transforms(
        device=torch.device("cuda" if torch.cuda.is_available() else "cpu"),
        precision=torch.float32
    )
    
    checkpoint_path = Path("checkpoints/depth_pro.pt")
    if checkpoint_path.exists():
        state_dict = torch.load(str(checkpoint_path), map_location="cpu")
        model.load_state_dict(state_dict)
        print(f"✓ Loaded model from {checkpoint_path}")
    
    return model, transform

def generate_depth_map(image_path, output_path=None, visualize=True):
    """
    Generate depth map from image
    
    Args:
        image_path: Path to input image
        output_path: Path to save depth map (optional, defaults to input_depth.png)
        visualize: If True, saves a normalized grayscale visualization
    
    Returns:
        Path to generated depth map
    """
    print(f"Loading Depth Pro model...")
    model, transform = setup_depth_pro()
    
    # Load image
    image_path = Path(image_path)
    if not image_path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")
    
    image = Image.open(image_path)
    print(f"Processing: {image_path.name} ({image.size[0]}x{image.size[1]})")
    
    # Prepare input
    input_image = transform(image)
    
    # Run inference
    print("Generating depth map...")
    with torch.no_grad():
        if torch.cuda.is_available():
            model = model.cuda()
            input_image = input_image.cuda()
            print(f"Using GPU: {torch.cuda.get_device_name(0)}")
        
        prediction = model.infer(input_image)
    
    # Get depth prediction
    depth = prediction["depth"].cpu().numpy().squeeze()
    
    # Determine output path
    if output_path is None:
        output_path = image_path.parent / f"{image_path.stem}_depth.png"
    else:
        output_path = Path(output_path)
    
    # Save depth map
    if visualize:
        # Normalize depth to 0-255 for visualization
        depth_normalized = (depth - depth.min()) / (depth.max() - depth.min())
        depth_normalized = (depth_normalized * 255).astype(np.uint8)
        
        # Invert so closer = lighter (matches shader expectations)
        depth_normalized = 255 - depth_normalized
        
        depth_image = Image.fromarray(depth_normalized)
        depth_image.save(output_path)
        print(f"✓ Depth map saved: {output_path}")
        print(f"  Depth range: {depth.min():.2f}m to {depth.max():.2f}m")
    else:
        # Save raw depth values as 16-bit for precision
        depth_16bit = ((depth / depth.max()) * 65535).astype(np.uint16)
        depth_image = Image.fromarray(depth_16bit, mode='I;16')
        depth_image.save(output_path)
        print(f"✓ Raw depth saved: {output_path}")
    
    return output_path

def batch_process(input_dir, output_dir=None):
    """Process all images in a directory"""
    input_dir = Path(input_dir)
    
    if output_dir is None:
        output_dir = input_dir / "depth_maps"
    else:
        output_dir = Path(output_dir)
    
    output_dir.mkdir(exist_ok=True)
    
    # Find all image files
    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
    images = [f for f in input_dir.iterdir() 
              if f.suffix.lower() in image_extensions and not f.stem.endswith('_depth')]
    
    if not images:
        print(f"No images found in {input_dir}")
        return
    
    print(f"Found {len(images)} images to process\n")
    
    # Load model once for batch processing
    print("Loading Depth Pro model...")
    model, transform = setup_depth_pro()
    if torch.cuda.is_available():
        model = model.cuda()
        print(f"Using GPU: {torch.cuda.get_device_name(0)}\n")
    
    # Process each image
    for i, image_path in enumerate(images, 1):
        print(f"[{i}/{len(images)}] Processing: {image_path.name}")
        
        try:
            image = Image.open(image_path)
            input_image = transform(image)
            
            if torch.cuda.is_available():
                input_image = input_image.cuda()
            
            with torch.no_grad():
                prediction = model.infer(input_image)
            
            depth = prediction["depth"].cpu().numpy().squeeze()
            
            # Normalize and save
            depth_normalized = (depth - depth.min()) / (depth.max() - depth.min())
            depth_normalized = (depth_normalized * 255).astype(np.uint8)
            depth_normalized = 255 - depth_normalized
            
            output_path = output_dir / f"{image_path.stem}_depth.png"
            depth_image = Image.fromarray(depth_normalized)
            depth_image.save(output_path)
            
            print(f"  ✓ Saved: {output_path.name}")
            print(f"  Depth range: {depth.min():.2f}m to {depth.max():.2f}m\n")
            
        except Exception as e:
            print(f"  ✗ Error: {e}\n")
            continue
    
    print(f"Batch processing complete! Depth maps saved to: {output_dir}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate depth maps using Apple Depth Pro")
    parser.add_argument("input", help="Input image or directory")
    parser.add_argument("-o", "--output", help="Output path (optional)")
    parser.add_argument("-b", "--batch", action="store_true", 
                       help="Batch process all images in directory")
    parser.add_argument("--raw", action="store_true",
                       help="Save raw 16-bit depth instead of normalized 8-bit")
    
    args = parser.parse_args()
    
    try:
        if args.batch:
            batch_process(args.input, args.output)
        else:
            generate_depth_map(args.input, args.output, visualize=not args.raw)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

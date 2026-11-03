import { useState } from 'react';

export default function ProductGallery({ images = [], mainImage }) {
  const allImages = images.length > 0 ? images : [mainImage];
  const [selectedImage, setSelectedImage] = useState(allImages[0] || mainImage);

  return (
    <div className="flex flex-col lg:flex-row-reverse gap-4">
      {/* Main Image Display */}
      <div
        className="flex-1 aspect-[3/4] overflow-hidden relative border"
        style={{ backgroundColor: 'var(--bg-surface-sunken)', borderColor: 'var(--border-default)' }}
      >
        <img
          src={selectedImage}
          alt="Product detail view"
          className="w-full h-full object-cover object-center"
        />
      </div>

      {/* Thumbnail Bar */}
      {allImages.length > 1 && (
        <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto max-h-[500px]">
          {allImages.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedImage(img)}
              className={`w-20 aspect-[3/4] flex-shrink-0 overflow-hidden border transition-all ${
                selectedImage === img ? 'opacity-100' : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                backgroundColor: 'var(--bg-surface-sunken)',
                borderColor: selectedImage === img ? 'var(--color-primary)' : 'var(--border-default)',
                outline: selectedImage === img ? '1px solid var(--color-primary)' : 'none',
              }}
            >
              <img src={img} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

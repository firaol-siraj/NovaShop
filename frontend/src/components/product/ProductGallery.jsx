import { useState } from 'react';

export default function ProductGallery({ images = [], mainImage }) {
  const allImages = images.length > 0 ? images : [mainImage];
  const [selectedImage, setSelectedImage] = useState(allImages[0] || mainImage);

  return (
    <div className="flex flex-col lg:flex-row-reverse gap-4">
      {/* Main Image Display */}
      <div className="flex-1 aspect-[3/4] bg-stone-100 overflow-hidden relative border border-stone-200">
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
              className={`w-20 aspect-[3/4] flex-shrink-0 bg-stone-100 overflow-hidden border transition-all ${
                selectedImage === img ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-200 opacity-70 hover:opacity-100'
              }`}
            >
              <img src={img} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

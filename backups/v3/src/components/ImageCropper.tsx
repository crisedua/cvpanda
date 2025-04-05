import React from 'react';
import Cropper from 'react-cropper';
import { useTranslation } from 'react-i18next';
import 'cropperjs/dist/cropper.css';
import { X } from 'lucide-react';

interface ImageCropperProps {
  image: string;
  onCrop: (croppedImage: string) => void;
  onCancel: () => void;
  aspectRatio?: number;
}

const ImageCropper: React.FC<ImageCropperProps> = ({
  image,
  onCrop,
  onCancel,
  aspectRatio = 1
}) => {
  const { t } = useTranslation();
  const cropperRef = React.useRef<any>(null);

  const handleCrop = () => {
    const imageElement: any = cropperRef?.current;
    const cropper: any = imageElement?.cropper;
    
    if (cropper) {
      const croppedCanvas = cropper.getCroppedCanvas({
        width: 400, // Result image width
        height: 400, // Result image height
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      });
      
      const croppedImage = croppedCanvas.toDataURL('image/jpeg', 0.9);
      onCrop(croppedImage);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-medium">{t('profile.photo.adjust')}</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-4">
          <Cropper
            ref={cropperRef}
            src={image}
            style={{ height: 400, width: '100%' }}
            aspectRatio={aspectRatio}
            guides={true}
            preview=".preview"
            viewMode={1}
            dragMode="move"
            cropBoxMovable={true}
            cropBoxResizable={true}
            toggleDragModeOnDblclick={false}
          />
          
          <div className="mt-4 flex justify-end space-x-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('profile.photo.cancel')}
            </button>
            <button
              onClick={handleCrop}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              {t('profile.photo.save')}
            </button>
          </div>
        </div>
        
        <div className="p-4 border-t">
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">{t('profile.photo.preview')}:</div>
            <div className="preview w-16 h-16 overflow-hidden rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
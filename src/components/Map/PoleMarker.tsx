import React from 'react';
import { Marker } from 'react-map-gl';
import electricPoleIcon from '../../assets/electric-pole.png';

interface PoleMarkerProps {
  point: {
    id: string;
    lat: number;
    lng: number;
  };
  index: number;
  color: string;
  isActive: boolean;
  onClick: (e: any) => void;
}

const PoleMarker = React.memo(({ point, index, color, onClick, isActive }: PoleMarkerProps) => {
  return (
    <Marker
      longitude={point.lng}
      latitude={point.lat}
      anchor="bottom"
      onClick={onClick}
    >
      <div className="pole-marker-container" style={{ willChange: 'transform' }}>
        <img
          src={electricPoleIcon}
          alt={`Ponto ${index}`}
          className="pole-image"
          loading="lazy"
          style={{ pointerEvents: 'none' }}
        />

        <div
          className={`pole-number-plate ${isActive ? 'pole-active' : ''}`}
          style={{
            borderColor: color,
            color: color
          }}
        >
          {index}
        </div>
      </div>
    </Marker>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.point.id === nextProps.point.id &&
    prevProps.color === nextProps.color &&
    prevProps.isActive === nextProps.isActive
  );
});

export default PoleMarker;

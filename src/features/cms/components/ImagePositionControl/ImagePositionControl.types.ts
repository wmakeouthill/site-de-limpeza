import type { ImagePosition } from "../../types/cms.types";

export interface ImagePositionControlProps {
  value: ImagePosition;
  onChange: (position: ImagePosition) => void;
}

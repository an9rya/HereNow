import { PersonLocation } from "./location";

export interface PersonMovement {
  person: PersonLocation;
  targetLat: number;
  targetLng: number;
  startLat: number;
  startLng: number;
  progress: number;
  isMoving: boolean;
  nextMoveTime: number;
  currentDirection?: number; // Angle in radians for directional movement
  currentSpeed: number; // Speed in km/h
  targetSpeed: number; // Target speed for this movement segment (0-120 km/h)
  animationDuration: number; // Dynamic animation duration based on speed
  isInDowntown?: boolean; // Track whether person is currently inside downtown geofence
};
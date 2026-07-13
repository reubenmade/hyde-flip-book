import { customAlphabet } from "nanoid";

// URL-friendly, unambiguous alphabet. 10 chars ≈ unguessable for this scale.
export const newSlug = customAlphabet("23456789abcdefghijkmnpqrstuvwxyz", 10);

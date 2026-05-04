// src/types/banner.ts

export interface BannerModel {
  id: string;
  imageUrl: string;
  title?: string;
  redirectLink?: string;
  status: string;
  displayOrder: number;
}

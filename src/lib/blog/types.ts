export interface BlogPostSeoInput {
  title: string;
  slug: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  excerpt?: string | null;
  body: string;
  featuredImageAltText?: string | null;
  internalLinkCount: number;
  primaryKeyword?: string | null;
}

export interface SeoWarning {
  code: string;
  message: string;
  severity: "warning";
}

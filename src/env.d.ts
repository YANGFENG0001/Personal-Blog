/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Present only for an authenticated owner. */
    owner: { userId: string; username: string; csrfToken: string } | null;
    /** Owner explicitly viewing the public site "as a visitor". Never grants extra access. */
    preview: boolean;
  }
}

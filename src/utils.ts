// Image compression using canvas
export function compressImage(
  fileOrBase64: File | string, 
  maxWidth: number, 
  maxHeight: number, 
  qualityOrSize: number = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const processImageSource = (src: string) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio fitting
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src); // fallback
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Compress with quality scaling
        const qualityValue = qualityOrSize > 1 ? 0.7 : qualityOrSize;
        const base64 = canvas.toDataURL('image/jpeg', qualityValue);
        resolve(base64);
      };
      img.onerror = (err) => reject(err);
    };

    if (typeof fileOrBase64 === 'string') {
      processImageSource(fileOrBase64);
    } else {
      const reader = new FileReader();
      reader.readAsDataURL(fileOrBase64);
      reader.onload = (event) => {
        processImageSource(event.target?.result as string);
      };
      reader.onerror = (err) => reject(err);
    }
  });
}

// Format relative timestamp like "2h", "15m", "3d"
export function formatRelativeTime(timestamp: any): string {
  if (!timestamp) return 'now';
  
  let date: Date;
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDays < 7) return `${diffDays}d`;
  
  // Format as short date (e.g., Jul 4)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Format location and date details
export function formatMonthYear(timestamp: any): string {
  if (!timestamp) return 'Joined July 2026';
  
  let date: Date;
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }

  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Generate an elegant, solid-colored avatar placeholder based on a user's display name or handle
export function getAvatarColor(name: string): string {
  const colors = [
    '#1e40af', '#1e3a8a', '#115e59', '#15803d', '#b45309', '#9a3412', '#7c3aed', '#6b21a8', '#9d174d', '#0f766e'
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return colors[sum % colors.length];
}

export function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Strict Input Sanitization helper to protect against common web attacks (XSS, HTML injection)
 * Strips script tags, general HTML tags, javascript: protocols, and inline event triggers.
 */
export function sanitizeInput(val: string): string {
  if (typeof val !== 'string') return '';
  // Remove script tags and their inner content
  let cleaned = val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove all other HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  // Remove dangerous inline DOM attributes (like onclick, onerror, onload, etc.)
  cleaned = cleaned.replace(/on\w+\s*=\s*"[^"]*"/gi, '');
  cleaned = cleaned.replace(/on\w+\s*=\s*'[^']*'/gi, '');
  cleaned = cleaned.replace(/on\w+\s*=\s*[^\s>]+/gi, '');
  // Remove javascript: and data: URIs
  cleaned = cleaned.replace(/(javascript|data)\s*:\s*/gi, '');
  return cleaned.trim();
}

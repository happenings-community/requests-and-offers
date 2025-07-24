# Avatar Utilities Pattern

## Overview

We've established a clean **Avatar Utilities Pattern** that leverages the static `default_avatar.webp` image for consistent placeholder/fallback behavior across the application. This replaces complex programmatic image generation with a simple, efficient approach.

## Available Utilities

### Core Functions

Located in `ui/src/lib/utils/index.ts`:

#### 1. `getDefaultAvatarUrl()`
**Purpose**: Gets the URL path to the default avatar image.
**Returns**: `string` - Path to `/default_avatar.webp`

```typescript
import { getDefaultAvatarUrl } from '$lib/utils';

const defaultUrl = getDefaultAvatarUrl(); // '/default_avatar.webp'
```

#### 2. `getAvatarUrl(avatarUrl?: string | null)`
**Purpose**: Gets a user's avatar URL or falls back to the default avatar.
**Returns**: `string` - The avatar URL or default avatar path

```typescript
import { getAvatarUrl } from '$lib/utils';

// With user avatar
const userAvatarUrl = getAvatarUrl('https://example.com/user.jpg');

// Without user avatar (uses default)
const defaultAvatarUrl = getAvatarUrl(null); // '/default_avatar.webp'
const undefinedAvatarUrl = getAvatarUrl(); // '/default_avatar.webp'
```

#### 3. `getDefaultAvatarBytes()`
**Purpose**: Loads the default avatar as bytes for Holochain storage.
**Returns**: `Promise<Uint8Array>` - Default avatar as binary data

```typescript
import { getDefaultAvatarBytes } from '$lib/utils';

// For Holochain storage scenarios
const avatarBytes = await getDefaultAvatarBytes();
```

#### 4. `fetchImageAndConvertToUInt8Array(url: string)`
**Purpose**: Fetches any image URL and converts to bytes, with default avatar fallback.
**Returns**: `Promise<Uint8Array>` - Image data or default avatar as fallback

```typescript
import { fetchImageAndConvertToUInt8Array } from '$lib/utils';

// Attempts to fetch image, falls back to default avatar on failure
const imageBytes = await fetchImageAndConvertToUInt8Array('https://example.com/image.jpg');
```

## Components

### UserAvatar Component

A reusable avatar component that automatically handles fallbacks:

```svelte
<!-- UserAvatar.svelte -->
<script>
  import { getAvatarUrl } from '$lib/utils';
  
  let { avatarUrl, alt = 'User avatar', size = 'w-12 h-12' } = $props();
  
  const imageUrl = $derived(getAvatarUrl(avatarUrl));
</script>

<img 
  src={imageUrl} 
  {alt}
  class="rounded-full object-cover {size}"
  loading="lazy"
/>
```

### Usage Examples

```svelte
<!-- Basic usage -->
<UserAvatar avatarUrl={user.avatar} alt={user.name} />

<!-- Custom size -->
<UserAvatar 
  avatarUrl={user.avatar} 
  alt={user.name}
  size="w-16 h-16"
/>

<!-- No avatar provided (uses default) -->
<UserAvatar alt="Default user" />
```

## Migration Guide

### From Complex Image Generation

**Before** (complex programmatic generation):
```typescript
function generatePlaceholderImage(): Uint8Array {
  // 50+ lines of PNG binary creation...
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, /* ... */];
  // Complex chunk creation...
  return new Uint8Array([...pngSignature, ...ihdrChunk, /* ... */]);
}
```

**After** (simple static file usage):
```typescript
import { getDefaultAvatarUrl, getDefaultAvatarBytes } from '$lib/utils';

// For HTML img src
const avatarUrl = getDefaultAvatarUrl();

// For binary data (Holochain storage)
const avatarBytes = await getDefaultAvatarBytes();
```

### From Manual Fallback Logic

**Before** (manual fallback handling):
```svelte
<script>
  let avatarSrc = user.avatar || '/some/default/path.png';
  
  function handleImageError() {
    avatarSrc = '/fallback.png';
  }
</script>

<img src={avatarSrc} on:error={handleImageError} />
```

**After** (automatic fallback):
```svelte
<script>
  import { getAvatarUrl } from '$lib/utils';
  
  const avatarSrc = $derived(getAvatarUrl(user.avatar));
</script>

<img src={avatarSrc} alt="User avatar" />
```

## Static Assets

### Available Images

Located in `ui/static/`:

- **`default_avatar.webp`** (1.9KB) - Default user avatar
- **`hAppeningsCIClogo.png`** (61KB) - Organization logo  
- **`hAppeningsLogoWsun2.webp`** (43KB) - Main logo with sun
- **`icon.png`** (79KB) - Application icon

### Best Practices

1. **Consistent Paths**: Always use `getDefaultAvatarUrl()` instead of hardcoding paths
2. **Lazy Loading**: Use `loading="lazy"` for performance
3. **Proper Alt Text**: Always provide meaningful alt text
4. **Responsive Sizing**: Use Tailwind/Skeleton classes for consistent sizing
5. **Fallback Styling**: Include CSS fallbacks for loading states

## Performance Benefits

### Before vs After

| **Aspect** | **Before (Generated)** | **After (Static File)** |
|------------|------------------------|--------------------------|
| **Bundle Size** | +2KB complex generation code | ✅ No generation code |
| **Runtime Performance** | 🐌 Generate on each call | ✅ Instant file serving |
| **Memory Usage** | 📈 Creates new arrays | ✅ Reuses cached file |
| **Network** | ❌ No caching | ✅ Browser caches file |
| **Quality** | 📉 1x1 transparent pixel | ✅ Proper avatar image |

### Optimization Features

1. **Browser Caching**: Static files are cached by browsers
2. **CDN Ready**: Can be served from CDN for global performance
3. **Lazy Loading**: Built-in lazy loading support
4. **WebP Format**: Efficient modern image format
5. **Small Size**: Only 1.9KB for high-quality default avatar

## Integration Examples

### User Profile Components

```svelte
<!-- UserCard.svelte -->
<script>
  import UserAvatar from '$lib/components/shared/UserAvatar.svelte';
  
  let { user } = $props();
</script>

<div class="card p-4">
  <UserAvatar 
    avatarUrl={user.avatar}
    alt={user.name}
    size="w-16 h-16"
  />
  <h3>{user.name}</h3>
  <p>{user.email}</p>
</div>
```

### Navigation Bar

```svelte
<!-- NavBar.svelte -->
<script>
  import { getAvatarUrl } from '$lib/utils';
  
  let { currentUser } = $props();
  
  const userAvatarUrl = $derived(getAvatarUrl(currentUser?.avatar));
</script>

<nav class="navbar">
  <div class="navbar-end">
    <div class="dropdown">
      <label tabindex="0" class="btn btn-ghost btn-circle avatar">
        <div class="w-10 rounded-full">
          <img src={userAvatarUrl} alt="User menu" />
        </div>
      </label>
    </div>
  </div>
</nav>
```

### Comment Systems

```svelte
<!-- Comment.svelte -->
<script>
  import UserAvatar from '$lib/components/shared/UserAvatar.svelte';
  
  let { comment } = $props();
</script>

<div class="comment flex gap-3">
  <UserAvatar 
    avatarUrl={comment.author.avatar}
    alt={comment.author.name}
    size="w-8 h-8"
  />
  <div class="content">
    <strong>{comment.author.name}</strong>
    <p>{comment.text}</p>
  </div>
</div>
```

## Holochain Integration

### Storing Avatar Data

```typescript
import { getDefaultAvatarBytes } from '$lib/utils';

// When user doesn't provide an avatar
async function createUserProfile(userData: UserData) {
  let avatarBytes: Uint8Array;
  
  if (userData.avatarFile) {
    // User provided avatar
    avatarBytes = new Uint8Array(await userData.avatarFile.arrayBuffer());
  } else {
    // Use default avatar
    avatarBytes = await getDefaultAvatarBytes();
  }
  
  return await holochainClient.callZome({
    role_name: 'users',
    zome_name: 'users',
    fn_name: 'create_user',
    payload: {
      ...userData,
      avatar: avatarBytes
    }
  });
}
```

### Fetching Remote Avatars

```typescript
import { fetchImageAndConvertToUInt8Array } from '$lib/utils';

// Automatically falls back to default avatar on fetch failure
async function syncUserAvatar(avatarUrl: string) {
  const avatarBytes = await fetchImageAndConvertToUInt8Array(avatarUrl);
  
  // Store in Holochain
  return await storeUserAvatar(avatarBytes);
}
```

## Testing

### Unit Tests

```typescript
import { getDefaultAvatarUrl, getAvatarUrl, getDefaultAvatarBytes } from '$lib/utils';

describe('Avatar Utilities', () => {
  test('getDefaultAvatarUrl returns correct path', () => {
    expect(getDefaultAvatarUrl()).toBe('/default_avatar.webp');
  });

  test('getAvatarUrl falls back to default', () => {
    expect(getAvatarUrl(null)).toBe('/default_avatar.webp');
    expect(getAvatarUrl(undefined)).toBe('/default_avatar.webp');
    expect(getAvatarUrl('')).toBe('/default_avatar.webp');
  });

  test('getAvatarUrl uses provided URL', () => {
    const url = 'https://example.com/avatar.jpg';
    expect(getAvatarUrl(url)).toBe(url);
  });

  test('getDefaultAvatarBytes loads image data', async () => {
    const bytes = await getDefaultAvatarBytes();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });
});
```

### Component Tests

```typescript
import { render } from '@testing-library/svelte';
import UserAvatar from '$lib/components/shared/UserAvatar.svelte';

test('UserAvatar uses default when no avatar provided', () => {
  const { container } = render(UserAvatar, { props: {} });
  const img = container.querySelector('img');
  
  expect(img?.src).toContain('/default_avatar.webp');
});

test('UserAvatar uses provided avatar URL', () => {
  const avatarUrl = 'https://example.com/user.jpg';
  const { container } = render(UserAvatar, { props: { avatarUrl } });
  const img = container.querySelector('img');
  
  expect(img?.src).toBe(avatarUrl);
});
```

This pattern provides a clean, efficient, and maintainable approach to avatar management throughout the application. 
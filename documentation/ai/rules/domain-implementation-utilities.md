# Domain Implementation: Utilities & Avatars

## Avatar Management

```ts
export const AvatarService = Context.GenericTag<AvatarService>("AvatarService");

export const makeAvatarService = Effect.gen(function* () {
  const storageService = yield* StorageService;
  const imageService = yield* ImageService;

  const uploadAvatar = (userId: string, imageFile: File) =>
    Effect.gen(function* () {
      yield* validateImageFile(imageFile);

      const optimizedImage = yield* imageService.optimizeImage(imageFile, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.8,
        format: "webp",
      });

      const avatarPath = `avatars/${userId}/${Date.now()}.webp`;
      const avatarUrl = yield* storageService.uploadFile(
        avatarPath,
        optimizedImage,
      );

      yield* userService.updateProfile(userId, { avatarUrl });
      return avatarUrl;
    }).pipe(
      Effect.mapError(
        (error) =>
          new AvatarError({
            message: "Failed to upload avatar",
            cause: error,
            userId,
          }),
      ),
    );

  const deleteAvatar = (userId: string) =>
    Effect.gen(function* () {
      const user = yield* userService.getUser(userId);
      if (user.avatarUrl) {
        yield* storageService.deleteFile(user.avatarUrl);
        yield* userService.updateProfile(userId, { avatarUrl: null });
      }
    });

  const generateAvatarInitials = (name: string) =>
    Effect.sync(() => {
      const words = name.trim().split(/\s+/);
      const initials = words
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join("");
      return initials || "?";
    });

  return {
    uploadAvatar,
    deleteAvatar,
    generateAvatarInitials,
  };
});

export const useAvatarDisplay = () => {
  const avatarService = yield* AvatarService;

  const getAvatarDisplay = (user: User) =>
    Effect.gen(function* () {
      if (user.avatarUrl) {
        return {
          type: "image" as const,
          src: user.avatarUrl,
          alt: `${user.name}'s avatar`,
        };
      }

      const initials = yield* avatarService.generateAvatarInitials(user.name);
      return {
        type: "initials" as const,
        initials,
        alt: `${user.name}'s initials`,
      };
    });

  return { getAvatarDisplay };
};
```

## Common Utilities

```ts
export const generateSlug = (text: string) =>
  Effect.sync(
    () =>
      text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, ""),
  );

export const normalizeTags = (
  tags: string[],
): Effect.Effect<string[], ValidationError> =>
  Effect.gen(function* () {
    const normalized = tags
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0)
      .filter((tag, index, array) => array.indexOf(tag) === index);

    if (normalized.length > 10) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Maximum 10 tags allowed",
          field: "tags",
          value: tags,
          constraint: "maxLength",
        }),
      );
    }

    return normalized;
  });

export const formatDateForDisplay = (date: Date) =>
  Effect.sync(() => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  });

export const truncateText = (text: string, maxLength: number) =>
  Effect.sync(() => {
    if (text.length <= maxLength) return text;
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > 0) return truncated.substring(0, lastSpace) + "...";
    return truncated + "...";
  });
```

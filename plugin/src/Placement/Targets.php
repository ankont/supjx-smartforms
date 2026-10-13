<?php
declare(strict_types=1);
namespace SuperSoft\Plugin\System\SmartForms\Placement;
defined('_JEXEC') or die;

/** Stable placement identities, independent of component layouts and control IDs. */
final class Targets
{
    public const CONTEXTS = [
        'com_content.article' => ['article-text', 'content-settings', 'publishing', 'metadata'],
        'com_content.categories' => ['category-description', 'content-settings', 'category-options', 'publishing', 'metadata'],
        'com_users.user' => ['user-account', 'user-settings'],
    ];

    public static function ids(?string $context = null): array
    {
        return $context === null ? array_values(array_unique(array_merge(...array_values(self::CONTEXTS))))
            : (self::CONTEXTS[$context] ?? []);
    }

    public static function label(string $id): string
    {
        return match ($id) {
            'article-text' => 'PLG_SYSTEM_SMARTFORMS_TARGET_ARTICLE_TEXT',
            'category-description' => 'PLG_SYSTEM_SMARTFORMS_TARGET_CATEGORY_DESCRIPTION',
            'category-options' => 'PLG_SYSTEM_SMARTFORMS_TARGET_CATEGORY_OPTIONS',
            'content-settings' => 'PLG_SYSTEM_SMARTFORMS_TARGET_CONTENT_SETTINGS',
            'publishing' => 'PLG_SYSTEM_SMARTFORMS_TARGET_PUBLISHING',
            'metadata' => 'PLG_SYSTEM_SMARTFORMS_TARGET_METADATA',
            'user-account' => 'PLG_SYSTEM_SMARTFORMS_TARGET_USER_ACCOUNT',
            'user-settings' => 'PLG_SYSTEM_SMARTFORMS_TARGET_USER_SETTINGS',
            default => throw new \InvalidArgumentException('Unknown placement target.'),
        };
    }

    public static function formContext(string $name): ?string
    {
        return match ($name) {
            'com_content.article', 'com_content.form' => 'com_content.article',
            'com_categories.categorycom_content' => 'com_content.categories',
            'com_users.user', 'com_users.profile' => 'com_users.user',
            default => null,
        };
    }
}

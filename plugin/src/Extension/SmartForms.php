<?php

declare(strict_types=1);

namespace SuperSoft\Plugin\System\SmartForms\Extension;

defined('_JEXEC') or die;

use Joomla\CMS\Document\HtmlDocument;
use Joomla\CMS\Event\Model\BeforeSaveEvent;
use Joomla\CMS\Event\Model\PrepareDataEvent;
use Joomla\CMS\Event\Model\PrepareFormEvent;
use Joomla\CMS\Form\Form;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Log\Log;
use Joomla\CMS\Plugin\CMSPlugin;
use Joomla\Event\Priority;
use Joomla\Event\SubscriberInterface;
use SuperSoft\Plugin\System\SmartForms\Adapter\FormAdapter;
use SuperSoft\Plugin\System\SmartForms\Placement\Targets;
use SuperSoft\Plugin\System\SmartForms\Placement\GroupPlacement;
use SuperSoft\Plugin\System\SmartForms\Presentation\FieldGroupNotes;

final class SmartForms extends CMSPlugin implements SubscriberInterface
{
    protected $autoloadLanguage = true;
    private ?Form $editorForm = null;

    public static function getSubscribedEvents(): array
    {
        return [
            'onContentPrepareData' => 'prepareGroupData',
            'onContentPrepareForm' => ['prepareForm', Priority::LOW],
            'onContentBeforeSave' => 'saveGroupPlacement',
            'onBeforeCompileHead' => 'prepareAssets',
            'onAfterDispatch' => 'prepareGroupList',
        ];
    }

    public function prepareGroupData(PrepareDataEvent $event): void
    {
        $data = $event->getData();
        if ($event->getContext() !== 'com_fields.group' || !$this->isSupportedGroup((array) $data)) {
            return;
        }
        $prepared = GroupPlacement::prepare((array) $data);
        if (is_object($data)) {
            foreach ($prepared as $key => $value) {
                $data->$key = $value;
            }
            $event->updateData($data);
        } else {
            $event->updateData($prepared);
        }
    }

    public function prepareForm(PrepareFormEvent $event): void
    {
        $form = $event->getForm();
        $context = str_replace('com_fields.group.', '', $form->getName());
        if ($this->getApplication()->isClient('administrator') && str_starts_with($form->getName(), 'com_fields.group.') && Targets::ids($context)) {
            // Populate options before loading: replacing a loaded field appends it after Mode.
            $settings = simplexml_load_file(dirname(__DIR__, 2) . '/forms/placement.xml');
            $field = $settings->xpath('//field[@name="smartforms_target"]')[0];
            foreach (Targets::ids($context) as $target) {
                $field->addChild('option', Targets::label($target))->addAttribute('value', $target);
            }
            $form->load($settings, false);
            $form->setFieldAttribute('note', 'validate', 'placementnote');
            $form->setFieldAttribute('note', 'message', 'PLG_SYSTEM_SMARTFORMS_NOTE_TOO_LONG');
            return;
        }
        if ($this->editorAdapter() !== null && FormAdapter::supports($form)
            && Targets::formContext($form->getName()) === $this->editorContext()) {
            $this->editorForm = $form;
        }
    }

    public function saveGroupPlacement(BeforeSaveEvent $event): void
    {
        $item = $event->getItem();
        $data = $event->getData();
        if ($event->getContext() !== 'com_fields.group' || !$this->isSupportedGroup((array) $item)
            || (string) ($data['smartforms_present'] ?? '') !== '1') {
            return;
        }
        try {
            $item->note = GroupPlacement::noteForSave(array_merge($data, ['context' => $item->context]));
        } catch (\LengthException $error) {
            throw new \RuntimeException(Text::_($error->getMessage()), 0, $error);
        }
    }

    public function prepareAssets(): void
    {
        if (!$this->editorForm || $this->editorAdapter() === null) {
            return;
        }
        $app = $this->getApplication();
        $document = $app->getDocument();
        if (!$document instanceof HtmlDocument) {
            return;
        }
        try {
            $model = $app->bootComponent('com_fields')->getMVCFactory()->createModel('Groups', 'Administrator', ['ignore_request' => true]);
            $context = Targets::formContext($this->editorForm->getName());
            $model->setState('filter.context', $context);
            $model->setState('list.limit', 0);
            $config = FormAdapter::configuration($this->editorForm, $model->getItems() ?: [], $this->editorAdapter());
            if (!$config['groups']) {
                return;
            }
            $config['labels'] = [
                'toggle' => Text::_('PLG_SYSTEM_SMARTFORMS_TOGGLE_LABEL'),
                'view' => Text::_('PLG_SYSTEM_SMARTFORMS_VIEW_LABEL'),
            ];
            foreach ($config['targets'] as $target) $config['labels'][$target] = Text::_(Targets::label($target));
            $document->addScriptOptions('plg_system_smartforms', $config);
            $assets = $document->getWebAssetManager();
            $assets->getRegistry()->addExtensionRegistryFile('plg_system_smartforms');
            $assets->useStyle('plg_system_smartforms.placement')->useScript('plg_system_smartforms.placement');
        } catch (\Throwable $error) {
            // Optional placement must never prevent Joomla's original form from working.
            try {
                Log::add('SmartForms could not prepare placement: ' . $error->getMessage(), Log::WARNING, 'plg_system_smartforms');
            } catch (\Throwable $logError) {
                // An unwritable log directory must not turn an optional placement failure into a page error.
            }
        }
    }

    public function prepareGroupList(): void
    {
        $app = $this->getApplication();
        $input = $app->getInput();
        if (!$app->isClient('administrator') || $input->getCmd('option') !== 'com_fields'
            || $input->getCmd('view') !== 'groups') {
            return;
        }
        $context = $input->getCmd('context') ?: $app->getUserState('com_fields.groups.context', '');
        $document = $app->getDocument();
        if (!Targets::ids($context) || !$document instanceof HtmlDocument) {
            return;
        }
        $html = $document->getBuffer('component');
        if (!is_string($html) || $html === '') {
            return;
        }
        $marker = '__SMARTFORMS_LIST_NOTE__';
        $clean = FieldGroupNotes::clean($html, Text::sprintf('JGLOBAL_LIST_NOTE', $marker), $marker, $context);
        if ($clean !== $html) {
            $document->setBuffer($clean, ['type' => 'component']);
        }
    }

    private function isSupportedGroup(array $data): bool
    {
        return $this->getApplication()->isClient('administrator') && Targets::ids($data['context'] ?? '') !== [];
    }

    private function editorAdapter(): ?string
    {
        $app = $this->getApplication();
        $input = $app->getInput();
        $option = $input->getCmd('option');
        $view = $input->getCmd('view');
        if ($option === 'com_smartbrowser' && $view === 'editor' && in_array($input->getCmd('type'), ['article', 'category', 'user'], true) && !$input->getBool('done')) return 'smartbrowser';
        if ($app->isClient('administrator')) {
            if (($option === 'com_content' && $view === 'article') || ($option === 'com_users' && $view === 'user')
                || ($option === 'com_categories' && $view === 'category' && $input->getCmd('extension', 'com_content') === 'com_content')) return 'native-admin';
        } elseif ($app->isClient('site')) {
            if ($option === 'com_content' && $view === 'form') return 'native-article-site';
            if ($option === 'com_users' && $view === 'profile' && $input->getCmd('layout') === 'edit') return 'native-profile';
        }
        return null;
    }

    private function editorContext(): ?string
    {
        $input = $this->getApplication()->getInput();
        return match ($input->getCmd('option')) {
            'com_content' => 'com_content.article', 'com_categories' => 'com_content.categories',
            'com_users' => 'com_users.user',
            'com_smartbrowser' => match ($input->getCmd('type')) {
                'article' => 'com_content.article', 'category' => 'com_content.categories',
                'user' => 'com_users.user', default => null,
            },
            default => null,
        };
    }
}

<?php

declare(strict_types=1);
require __DIR__ . '/joomla-bootstrap.php';

use Joomla\CMS\Event\Model\BeforeSaveEvent;
use Joomla\CMS\Event\Model\PrepareDataEvent;
use Joomla\CMS\Event\Model\PrepareFormEvent;
use Joomla\CMS\Form\Form;
use Joomla\CMS\HTML\HTMLHelper;
use Joomla\CMS\Layout\LayoutHelper;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Event\Application\AfterDispatchEvent;
use SuperSoft\Plugin\System\SmartForms\Extension\SmartForms;
use SuperSoft\Plugin\System\SmartForms\Adapter\FormAdapter;

$count = 0;
function check(bool $valid, string $message): void {
    global $count;
    if (!$valid) throw new RuntimeException($message);
    ++$count;
}
$plugin = new SmartForms($app->getDispatcher(), ['name' => 'smartforms', 'type' => 'system']);
$plugin->setApplication($app);
$app->getDispatcher()->addSubscriber($plugin);
function prepare(array|object $data): array|object {
    global $app;
    $event = new PrepareDataEvent('onContentPrepareData', ['context' => 'com_fields.group', 'data' => $data]);
    $app->getDispatcher()->dispatch('onContentPrepareData', $event);
    return $event->getData();
}
function form(): Form {
    global $app;
    $form = nativeForm('com_fields.group.com_content.article', ['control' => 'jform']);
    $form->load('<form><fieldset><field name="title" type="text" required="true"/><field name="context" type="hidden"/><field name="note" type="text"/></fieldset></form>');
    $app->getDispatcher()->dispatch('onContentPrepareForm', new PrepareFormEvent('onContentPrepareForm', ['subject' => $form, 'data' => []]));
    return $form;
}
foreach (['^' => 'toggle', '-' => 'before', '+' => 'after'] as $symbol => $mode) {
    foreach ([false, true] as $object) {
        $data = ['context' => 'com_content.article', 'note' => 'Keep @future+ @article-text' . $symbol];
        $prepared = (array) prepare($object ? (object) $data : $data);
        check($prepared['note'] === 'Keep @future+' && $prepared['smartforms_mode'] === $mode, 'Native PrepareDataEvent failed');
        $form = form();
        $form->bind($prepared);
        check($form->getValue('smartforms_target') === 'article-text', 'Native Form binding lost placement');
        check(count($form->getFieldset('smartforms')) === 3, 'Settings fieldset missing');
        check(str_contains($form->getInput('smartforms_mode'), 'jform[smartforms_mode]'), 'Native list control did not render');
        check($form->getFieldAttribute('smartforms_mode', 'showon') === 'smartforms_target!:joomla', 'Mode visibility wrong');
        check($form->process($prepared) === false, 'Missing title should fail Joomla validation');
        $retry = (array) prepare($prepared);
        $retry['title'] = 'Group';
        $valid = $form->process($retry);
        check(is_array($valid), 'Validation retry failed: ' . json_encode($form->getErrors()));
        $item = (object) ['context' => 'com_content.article', 'note' => $valid['note']];
        $app->getDispatcher()->dispatch('onContentBeforeSave', new BeforeSaveEvent('onContentBeforeSave', [
            'context' => 'com_fields.group', 'subject' => $item, 'isNew' => true, 'data' => $valid,
        ]));
        check($item->note === $data['note'], 'Native BeforeSaveEvent lost note/directive');
    }
}
$form = form();
$data = (array) prepare(['title' => 'Group', 'context' => 'com_content.article', 'note' => '@article-text^']);
$data['note'] = str_repeat('α', 241);
check($form->process($data) === false, 'Composed oversized note passed native validation');
$data['note'] = 'Safe';
$data['smartforms_target'] = 'unknown';
check($form->process($data) === false, 'Unsupported target passed native options validation');
$other = ['context' => 'com_tags.tag', 'note' => 'Keep @article-text^'];
check(prepare($other) === $other, 'Unrelated context was modified');
$app->testClient = 'site';
check(prepare(['context' => 'com_content.article', 'note' => '@article-text^'])['note'] === '@article-text^', 'Site group settings were modified');
$app->testClient = 'administrator';
$article = nativeForm('com_content.article', ['control' => 'jform']);
$article->load('<form><field name="articletext" type="textarea"/><fields name="com_fields"><fieldset name="fields-9"><field name="second" type="text"/></fieldset><fieldset name="fields-2"><field name="first" type="text"/></fieldset></fields></form>');
$config = FormAdapter::configuration($article, [
    (object) ['id' => 2, 'context' => 'com_content.article', 'note' => '@article-text^'],
    (object) ['id' => 9, 'context' => 'com_content.article', 'note' => '@article-text-'],
    (object) ['id' => 88, 'context' => 'com_content.article', 'note' => '@article-text+'],
]);
check(array_column($config['groups'], 'fieldset') === ['fields-9', 'fields-2'], 'Adapter changed rendered Joomla ordering');
check($config['groups'][0]['fieldIds'] === ['jform_com_fields_second'], 'Adapter mapped wrong control IDs');
check(FormAdapter::supports($article), 'Article form unrecognized');
$native = nativeForm('com_users.user');
$native->load('<form><field name="articletext" type="text"/></form>');
check(!FormAdapter::supports($native), 'Unrelated editor recognized');
$plugin->prepareAssets(); // Missing SmartBrowser never invokes a database or asset lookup.
check(!$app->getDocument()->getScriptOptions('plg_system_smartforms'), 'Unrelated page received assets');

// Verify the actual installed core Field Group definition and its generic params-tab layout.
$coreGroup = nativeForm('com_fields.group.com_content.article', ['control' => 'jform']);
$coreGroup->loadFile(JPATH_ADMINISTRATOR . '/components/com_fields/forms/group.xml');
$app->getDispatcher()->dispatch('onContentPrepareForm', new PrepareFormEvent('onContentPrepareForm', ['subject' => $coreGroup, 'data' => []]));
$coreGroup->bind((array) prepare(['context' => 'com_content.article', 'note' => 'Human note @article-text+']));
check(!str_contains($coreGroup->getInput('note'), '@article-text'), 'Actual group note shows technical directive');
check(str_contains($coreGroup->renderFieldset('smartforms'), 'data-showon='), 'Actual settings mode did not render showon behavior');
$app->getDocument()->getWebAssetManager()->getRegistry()->addRegistryFile('media/system/joomla.asset.json')->addRegistryFile('media/vendor/joomla.asset.json');
HTMLHelper::_('uitab.startTabSet', 'myTab', ['active' => 'general']);
$layoutData = new class ($coreGroup) {
    public $fieldset;
    public $showOptions;
    public function __construct(private Form $form) {}
    public function getForm(): Form { return $this->form; }
    public function get($name, $default = null) {
        return match ($name) { 'useCoreUI' => true, 'ignore_fieldsets' => ['basic'], default => $this->{$name} ?? $default };
    }
};
$layout = LayoutHelper::render('joomla.edit.params', $layoutData);
check(str_contains($layout, 'id="attrib-smartforms"'), 'Actual group layout did not create SmartForms tab');
check(str_contains($layout, 'jform[smartforms_target]') && str_contains($layout, 'jform[smartforms_mode]'), 'Actual group tab lost controls');
check(str_contains($layout, 'name="Form Placements"'), 'Settings tab title was not shortened');

$app->getLanguage()->load('joomla', JPATH_ADMINISTRATOR);
$input = $app->getInput();
$input->set('option', 'com_fields');
$input->set('view', 'groups');
$input->set('context', 'com_content.article');
$storedNote = 'Normal note @article-text-';
$list = '<table id="fieldgroupList"><div class="small break-word">' . Text::sprintf('JGLOBAL_LIST_NOTE', $storedNote) . '</div></table>';
$document = $app->getDocument();
$document->setBuffer($list, ['type' => 'component']);
$app->getDispatcher()->dispatch('onAfterDispatch', new AfterDispatchEvent('onAfterDispatch', ['subject' => $app]));
check(!str_contains($document->getBuffer('component'), '@article-text'), 'Native list dispatch did not hide directive');
check(str_contains($document->getBuffer('component'), 'Normal note'), 'Native list dispatch lost normal note');
check($storedNote === 'Normal note @article-text-', 'List presentation changed stored note');
foreach (['com_tags.tag', 'com_contact.contact'] as $context) {
    $input->set('context', $context);
    $document->setBuffer($list, ['type' => 'component']);
    $plugin->prepareGroupList();
    check($document->getBuffer('component') === $list, 'Unsupported group context changed');
}
$input->set('context', 'com_content.article');
$input->set('view', 'fields');
$plugin->prepareGroupList();
check($document->getBuffer('component') === $list, 'Field list changed');
$input->set('view', 'groups');
$app->testClient = 'site';
$plugin->prepareGroupList();
check($document->getBuffer('component') === $list, 'Frontend buffer changed');
echo 'Joomla ' . JVERSION . " native form/event checks: $count passed\n";

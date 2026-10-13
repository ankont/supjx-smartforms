<?php
require __DIR__ . '/joomla-bootstrap.php';
use Joomla\CMS\Event\Model\PrepareDataEvent;
use Joomla\CMS\Event\Model\PrepareFormEvent;
use Joomla\CMS\Event\Model\BeforeSaveEvent;
use Joomla\CMS\Event\Application\AfterDispatchEvent;
use Joomla\CMS\Language\Text;
use SuperSoft\Plugin\System\SmartForms\Extension\SmartForms;
use SuperSoft\Plugin\System\SmartForms\Placement\Targets;
use SuperSoft\Plugin\System\SmartForms\Placement\Directive;
use SuperSoft\Plugin\System\SmartForms\Placement\GroupPlacement;
use SuperSoft\Plugin\System\SmartForms\Adapter\FormAdapter;
$count=0;
function check(bool $valid,string $message): void {global $count;if(!$valid)throw new RuntimeException($message);++$count;}
$plugin=new SmartForms($app->getDispatcher(),['name'=>'smartforms','type'=>'system']);$plugin->setApplication($app);
$app->getLanguage()->load('joomla', JPATH_ADMINISTRATOR);
foreach(Targets::CONTEXTS as $context=>$targets) {
  foreach($targets as $target) foreach(Directive::MODES as $mode=>$symbol) {
    $stored='Human @unknown+ @'.$target.$symbol;
    $event=new PrepareDataEvent('onContentPrepareData',['context'=>'com_fields.group','data'=>['context'=>$context,'title'=>'Group','note'=>$stored]]);
    $plugin->prepareGroupData($event);$data=$event->getData();
    check($data['note']==='Human @unknown+' && $data['smartforms_target']===$target && $data['smartforms_mode']===$mode,'Context initialization');
    $form=nativeForm('com_fields.group.'.$context,['control'=>'jform']);
    $form->load('<form><fieldset><field name="context" type="hidden"/><field name="title" type="text" required="true"/><field name="note" type="text"/></fieldset></form>');
    $plugin->prepareForm(new PrepareFormEvent('onContentPrepareForm',['subject'=>$form,'data'=>$data]));
    $form->bind($data);
    check(array_map(static fn($field) => $field->fieldname, array_values($form->getFieldset('smartforms')))
      === ['smartforms_present', 'smartforms_target', 'smartforms_mode'], 'Target must precede Mode');
    $options=array_map(static fn($option)=>(string)$option['value'],$form->getXml()->xpath('//field[@name="smartforms_target"]/option'));
    foreach(Targets::ids() as $id)check(in_array($id,$options,true)===in_array($id,$targets,true),'Context options leak');
    $valid=$form->process($data);check(is_array($valid),'Native target validation');
    $item=(object)['context'=>$context,'note'=>$valid['note']];
    $plugin->saveGroupPlacement(new BeforeSaveEvent('onContentBeforeSave',['context'=>'com_fields.group','subject'=>$item,'isNew'=>true,'data'=>$valid]));
    check($item->note===$stored,'Context save roundtrip');
    $retry=GroupPlacement::prepare($data);check($retry===$data,'Failed-save retry loses selection');
    $app->getInput()->set('option','com_fields');$app->getInput()->set('view','groups');$app->getInput()->set('context',$context);
    $list='<table id="fieldgroupList"><div class="small break-word">'.Text::sprintf('JGLOBAL_LIST_NOTE',$stored).'</div></table>';
    $app->getDocument()->setBuffer($list,['type'=>'component']);$plugin->prepareGroupList();
    check(!str_contains($app->getDocument()->getBuffer('component'),'@'.$target),'List shows directive');
  }
  $old=GroupPlacement::prepare(['context'=>$context,'note'=>'Keep @jform_articletext^']);
  check($old['note']==='Keep @jform_articletext^' && $old['smartforms_target']==='joomla','Legacy directive should be ordinary note');
  foreach(array_diff(Targets::ids(),$targets) as $foreign)check(Directive::parse('@'.$foreign.'^',$context)['target']==='joomla','Foreign directive activated');
}
foreach(['com_content.article'=>'articletext','com_content.form'=>'articletext','com_categories.categorycom_content'=>'description','com_users.user'=>'username','com_users.profile'=>'username'] as $name=>$field) {
  $form=nativeForm($name,['control'=>'jform']);
  $form->load('<form><field name="'.$field.'" type="text"/><fields name="com_fields"><fieldset name="fields-8"><field name="eight" type="text"/></fieldset><fieldset name="fields-2"><field name="two" type="text"/></fieldset></fields></form>');
  $context=Targets::formContext($name);$target=Targets::ids($context)[0];
  $config=FormAdapter::configuration($form,[(object)['id'=>2,'context'=>$context,'note'=>'@'.$target.'^'],(object)['id'=>8,'context'=>$context,'note'=>'@'.$target.'-'],(object)['id'=>88,'context'=>'com_tags.tag','note'=>'@'.$target.'^']],'native-admin');
  check(FormAdapter::supports($form),'Supported native form rejected');
  check($config['context']===$context && array_column($config['groups'],'fieldset')===['fields-8','fields-2'],'Wrong form mapping/order');
}
$reflection=new ReflectionProperty(SmartForms::class,'editorForm');
foreach([['administrator','com_content','article','','com_content.article','articletext'],['administrator','com_categories','category','','com_categories.categorycom_content','description'],['administrator','com_users','user','','com_users.user','username'],['site','com_content','form','','com_content.form','articletext'],['site','com_users','profile','edit','com_users.profile','username'],['site','com_smartbrowser','editor','','com_users.user','username']] as [$client,$option,$view,$layout,$name,$field]) {
  $app->testClient=$client;$input=$app->getInput();$input->set('option',$option);$input->set('view',$view);$input->set('layout',$layout);$input->set('type','user');$input->set('extension','com_content');
  $form=nativeForm($name);$form->load('<form><field name="'.$field.'" type="text"/></form>');
  $reflection->setValue($plugin,null);$plugin->prepareForm(new PrepareFormEvent('onContentPrepareForm',['subject'=>$form,'data'=>[]]));
  check($reflection->getValue($plugin)===$form,'Route rejected editing form');
  $wrong=nativeForm('com_tags.tag');$wrong->load('<form><field name="description" type="text"/></form>');
  $reflection->setValue($plugin,null);$plugin->prepareForm(new PrepareFormEvent('onContentPrepareForm',['subject'=>$wrong,'data'=>[]]));
  check($reflection->getValue($plugin)===null,'Unrelated form captured');
}
echo "Extended native lifecycle checks: $count passed\n";

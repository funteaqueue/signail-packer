export type Language = 'en' | 'uk';

// Flat UI string dictionaries. Placeholders use {name}-style tokens,
// replaced by the t() helper from LanguageContext.
export const translations: Record<Language, Record<string, string>> = {
  en: {
    // Common
    'common.cancel': 'Cancel',
    'common.next': 'Next',
    'common.add': 'Add',
    'common.load': 'Load',

    // Pack header
    'header.title': 'Pack Creator',
    'header.packName': 'Pack Name',
    'header.author': 'Author',
    'header.upload': 'Upload',
    'header.repack': 'Repack',
    'header.repacking': 'Repacking...',
    'header.download': 'Download',
    'header.clear': 'Clear',

    // Image upload (shared by Find-a-Cat and Progressive Reveal editors)
    'upload.dragDrop': 'Drag & Drop image here',
    'upload.instructionsPrefix': 'or click below to upload from PC, load from URL, or press',
    'upload.instructionsPrefixShort': 'or upload from PC, load from URL, or press',
    'upload.instructionsSuffix': 'to paste from clipboard',
    'upload.fromPc': 'Upload from PC',
    'upload.fromUrl': 'Load Image from URL',
    'upload.changeImage': 'Change Image',
    'upload.corsError': 'CORS restriction on this server prevents automatic conversion to base64. Please save the image to your PC first, then upload it or copy/paste it.',
    'upload.loadError': 'Failed to load image from URL. Ensure the URL is valid and public.',
    'upload.fetchError': 'Error fetching image from URL.',

    // Find-a-Cat editor
    'findACat.whatToFind': 'What to find?*',
    'findACat.taskPlaceholder': 'e.g. Find all the cats, %total% in total, %left% left',
    'findACat.taskHelper': 'The full task text shown to players, describing the target item they need to search for on the image. You can optionally use the variables %total% (total number of targets) and %left% (how many are still left) — they are replaced live during the game.',
    'findACat.duration': 'Duration (seconds)*',
    'findACat.clickLimit': 'Click limit',
    'findACat.clickLimitHelper': 'Total clicks a player can spend (hits and misses). 0 = unlimited',
    'findACat.firstPlaceBonus': 'Bonus for 1st place',
    'findACat.firstPlaceBonusHelper': 'Extra points for the fastest solver, on top of the normal award. 0 = no bonus',
    'findACat.mapPreview': 'Map Preview',
    'findACat.dragDrawAreas': 'Drag & Draw Areas',
    'findACat.editorMode': 'Editor Mode',
    'findACat.previewMode': 'Preview Mode',
    'findACat.clearAll': 'Clear All',
    'findACat.confirmClearAll': 'Are you sure you want to clear all selected areas?',
    'findACat.confirmChangeImage': 'Change image? This will keep defined areas but let you load a new image.',
    'findACat.drawTip': '💡 Drag and draw rectangles over the image to mark where cats (or other targets) are hidden.',
    'findACat.definedAreas': 'Defined Areas ({count})',
    'findACat.noAreas': 'No areas marked yet. Draw one on the image!',
    'findACat.editArea': 'Edit Area #{number}',
    'findACat.areaColor': 'Area Color:',
    'findACat.left': 'Left (%)',
    'findACat.top': 'Top (%)',
    'findACat.width': 'Width (%)',
    'findACat.height': 'Height (%)',
    'findACat.deleteArea': 'Delete Area',
    'findACat.imageAlt': 'Cat search board',

    // Question modal
    'question.editTitle': 'Edit Question',
    'question.newTitle': 'New Question',
    'question.points': 'Points',
    'question.typeLabel': 'Question Type:',
    'question.correctPoints': 'Correct Points',
    'question.priceText': 'Price Text',
    'question.incorrectPoints': 'Incorrect Points',
    'question.firstPlaceBonus': 'Bonus for 1st place',
    'question.firstPlaceBonusHelperChoice': 'Extra points for the fastest correct answer, on top of the normal award. 0 = none',
    'question.firstPlaceBonusHelperText': 'Extra points for the fastest answerer, on top of the normal award. 0 = none',
    'question.correctAnswerNumber': 'Correct Answer (number)*',
    'question.correctAnswerHelper': 'Players submit numbers; the closest one wins',
    'question.durationSeconds': 'Duration (seconds)',
    'question.durationHelper': 'Time window to submit answers',
    'question.perfectBonus': 'Perfect guess bonus',
    'question.perfectBonusHelper': 'Extra points for the exact answer. 0 = none',
    'question.questionTitle': 'Question',
    'question.answerTitle': 'Answer',
    'question.answerExplanationTitle': 'Answer explanation (optional)',
    'question.addQuestion': 'Add Question',
    'question.addAnswer': 'Add Answer',
    'question.save': 'Save Question',

    // Question types
    'questionType.normal': 'Normal',
    'questionType.secret': 'Secret',
    'questionType.empty': 'Empty',
    'questionType.findACat': 'Find-a-Cat',
    'questionType.closeEnough': 'Close Enough',
    'questionType.choice': 'Choice',
    'questionType.textAnswer': 'Text Answer',
    'questionType.progressiveReveal': 'Progressive Reveal',

    // Question modal tabs
    'tab.findACatEditor': 'Find-a-Cat Editor',
    'tab.price': 'Price',
    'tab.imageEffect': 'Image & Effect',
    'tab.answer': 'Answer',
    'tab.question': 'Question',
    'tab.options': 'Options',

    // Question modal validation
    'validation.closeEnough': 'Please enter the numeric correct answer to save the question.',
    'validation.minTwoOptions': 'Please add at least two options to save the question.',
    'validation.atLeastOneCorrect': 'Please mark at least one option as correct.',
    'validation.exactlyOneCorrect': 'Please mark exactly one option as correct.',
    'validation.uploadImage': 'Please upload an image to save the question.',
    'validation.missingTask': 'the task text ("What to find?")',
    'validation.missingImage': 'an image upload',
    'validation.missingArea': 'at least one defined area',
    'validation.addMissing': 'Please add {items} to save the question.',

    // Rule form
    'ruleForm.addRule': 'Add Rule',
    'ruleForm.updateRule': 'Update Rule',
    'ruleForm.content': 'Content',
    'ruleForm.durationSeconds': 'Duration (seconds)',
    'ruleForm.ruleItem': '{type} Rule',
    'ruleForm.contentLabel': 'Content:',
    'ruleForm.durationLabel': 'Duration:',

    // Choice options editor
    'choice.multipleCorrect': 'Multiple correct answers',
    'choice.editOption': 'Edit option #{number}',
    'choice.newOption': 'New option (text, image, GIF, audio or video)',
    'choice.updateOption': 'Update Option',
    'choice.addOption': 'Add Option',
    'choice.optionsHeadingSingle': 'Options ({count}) — mark the correct one',
    'choice.optionsHeadingMultiple': 'Options ({count}) — mark the correct ones',
    'choice.noOptions': 'No options yet. Add at least two options and mark the correct answer.',
    'choice.correctAnswer': 'Correct answer',
    'choice.markCorrect': 'Mark as correct',

    // Basic info form
    'basicInfo.title': 'Basic Information',

    // Progressive reveal editor
    'reveal.hidingEffect': 'Hiding effect',
    'reveal.blur': 'Blur',
    'reveal.pixelate': 'Pixelate',
    'reveal.zoomOut': 'Zoom out',
    'reveal.speed': 'Reveal speed',
    'reveal.linear': 'Linear (even)',
    'reveal.slowStart': 'Slow start (stays hidden longer)',
    'reveal.fastStart': 'Fast start (uncovers a lot early)',
    'reveal.duration': 'Reveal duration (seconds)*',
    'reveal.durationHelper': 'Time for the image to fully reveal if nobody buzzes in',
    'reveal.preview': 'Reveal Preview',
    'reveal.confirmChangeImage': 'Change image?',
    'reveal.simulateProgress': 'Simulate reveal progress: {percent}%',

    // Game board
    'board.addNewTheme': 'Add New Theme',
    'board.noThemes': 'No themes yet',
    'board.noThemesHint': 'Click the + button below to create your first theme',

    // Theme row
    'theme.addQuestion': 'Add Question',
    'theme.unnamed': 'Unnamed Theme',

    // Question form (legacy step form)
    'questionForm.questions': 'Questions',
    'questionForm.questionItem': 'Question {id} ({type})',
    'questionForm.emptyQuestion': 'Empty Question',
    'questionForm.priceLabel': 'Price:',
    'questionForm.correctLabel': 'Correct:',
    'questionForm.incorrectLabel': 'Incorrect:',
    'questionForm.rules': 'Rules',
    'questionForm.afterRoundRules': 'After Round Rules',

    // Rounds form
    'rounds.title': 'Rounds and Themes',
    'rounds.addNewRound': 'Add New Round',
    'rounds.roundName': 'Round Name',
    'rounds.addRound': 'Add Round',
    'rounds.themeName': 'Theme Name',
    'rounds.themeDescription': 'Theme Description',
    'rounds.addTheme': 'Add Theme',

    // Pack form alerts
    'pack.uploadError': "Error loading JSON file. Please make sure it's a valid pack JSON file.",
    'pack.repackError': 'Failed to repack SIQ package. {message}',
    'pack.repackErrorFallback': 'Please make sure the SIQ archive is valid.',

    // Review form
    'review.title': 'Review Pack',
    'review.name': 'Name:',
    'review.author': 'Author:',
    'review.theme': 'Theme:',
    'review.description': 'Description:',
    'review.downloadJson': 'Download JSON',
  },
  uk: {
    // Common
    'common.cancel': 'Скасувати',
    'common.next': 'Далі',
    'common.add': 'Додати',
    'common.load': 'Завантажити',

    // Pack header
    'header.title': 'Редактор паків',
    'header.packName': 'Назва паку',
    'header.author': 'Автор',
    'header.upload': 'Імпортувати',
    'header.repack': 'Перепакувати',
    'header.repacking': 'Перепакування...',
    'header.download': 'Завантажити',
    'header.clear': 'Очистити',

    // Image upload (shared by Find-a-Cat and Progressive Reveal editors)
    'upload.dragDrop': 'Перетягніть зображення сюди',
    'upload.instructionsPrefix': 'або скористайтеся кнопками нижче, щоб завантажити з ПК чи за URL, або натисніть',
    'upload.instructionsPrefixShort': 'або завантажте з ПК чи за URL, або натисніть',
    'upload.instructionsSuffix': 'щоб вставити з буфера обміну',
    'upload.fromPc': 'Завантажити з ПК',
    'upload.fromUrl': 'Завантажити зображення за URL',
    'upload.changeImage': 'Змінити зображення',
    'upload.corsError': 'Обмеження CORS на цьому сервері не дозволяє автоматично конвертувати зображення в base64. Збережіть зображення на ПК і завантажте його, або скопіюйте та вставте.',
    'upload.loadError': 'Не вдалося завантажити зображення за URL. Переконайтеся, що посилання правильне й публічне.',
    'upload.fetchError': 'Помилка завантаження зображення за URL.',

    // Find-a-Cat editor
    'findACat.whatToFind': 'Що шукати?*',
    'findACat.taskPlaceholder': 'напр. Знайдіть всіх котиків, всього %total%, залишилось %left%',
    'findACat.taskHelper': 'Повний текст завдання, який бачать гравці: опис того, що треба знайти на зображенні. За бажанням використовуйте змінні %total% (загальна кількість цілей) та %left% (скільки ще залишилось) — вони підставляються наживо під час гри.',
    'findACat.duration': 'Тривалість (секунд)*',
    'findACat.clickLimit': 'Ліміт кліків',
    'findACat.clickLimitHelper': 'Скільки всього кліків може витратити гравець (влучання і промахи). 0 = без обмежень',
    'findACat.firstPlaceBonus': 'Бонус за 1-ше місце',
    'findACat.firstPlaceBonusHelper': 'Додаткові бали найшвидшому гравцю, понад звичайну винагороду. 0 = без бонусу',
    'findACat.mapPreview': 'Перегляд мапи',
    'findACat.dragDrawAreas': 'Малюйте області мишею',
    'findACat.editorMode': 'Режим редактора',
    'findACat.previewMode': 'Режим перегляду',
    'findACat.clearAll': 'Очистити все',
    'findACat.confirmClearAll': 'Ви впевнені, що хочете видалити всі позначені області?',
    'findACat.confirmChangeImage': 'Змінити зображення? Позначені області збережуться, але ви зможете завантажити нове зображення.',
    'findACat.drawTip': '💡 Малюйте прямокутники поверх зображення, щоб позначити, де сховані котики (або інші цілі).',
    'findACat.definedAreas': 'Позначені області ({count})',
    'findACat.noAreas': 'Областей ще немає. Намалюйте першу на зображенні!',
    'findACat.editArea': 'Редагувати область №{number}',
    'findACat.areaColor': 'Колір області:',
    'findACat.left': 'Зліва (%)',
    'findACat.top': 'Зверху (%)',
    'findACat.width': 'Ширина (%)',
    'findACat.height': 'Висота (%)',
    'findACat.deleteArea': 'Видалити область',
    'findACat.imageAlt': 'Ігрове поле пошуку',

    // Question modal
    'question.editTitle': 'Редагувати питання',
    'question.newTitle': 'Нове питання',
    'question.points': 'балів',
    'question.typeLabel': 'Тип питання:',
    'question.correctPoints': 'Бали за правильну відповідь',
    'question.priceText': 'Текст ціни',
    'question.incorrectPoints': 'Бали за неправильну відповідь',
    'question.firstPlaceBonus': 'Бонус за 1-ше місце',
    'question.firstPlaceBonusHelperChoice': 'Додаткові бали за найшвидшу правильну відповідь, понад звичайну винагороду. 0 = без бонусу',
    'question.firstPlaceBonusHelperText': 'Додаткові бали тому, хто відповів найшвидше, понад звичайну винагороду. 0 = без бонусу',
    'question.correctAnswerNumber': 'Правильна відповідь (число)*',
    'question.correctAnswerHelper': 'Гравці надсилають числа; перемагає найближче',
    'question.durationSeconds': 'Тривалість (секунд)',
    'question.durationHelper': 'Час на надсилання відповідей',
    'question.perfectBonus': 'Бонус за точну відповідь',
    'question.perfectBonusHelper': 'Додаткові бали за абсолютно точну відповідь. 0 = без бонусу',
    'question.questionTitle': 'Питання',
    'question.answerTitle': 'Відповідь',
    'question.answerExplanationTitle': "Пояснення відповіді (необов'язково)",
    'question.addQuestion': 'Додати питання',
    'question.addAnswer': 'Додати відповідь',
    'question.save': 'Зберегти питання',

    // Question types
    'questionType.normal': 'Звичайне',
    'questionType.secret': 'Секретне',
    'questionType.empty': 'Порожнє',
    'questionType.findACat': 'Знайди кота',
    'questionType.closeEnough': 'Найближча відповідь',
    'questionType.choice': 'Вибір варіанту',
    'questionType.textAnswer': 'Текстова відповідь',
    'questionType.progressiveReveal': 'Поступове відкриття',

    // Question modal tabs
    'tab.findACatEditor': 'Редактор «Знайди кота»',
    'tab.price': 'Бали',
    'tab.imageEffect': 'Зображення та ефект',
    'tab.answer': 'Відповідь',
    'tab.question': 'Питання',
    'tab.options': 'Варіанти',

    // Question modal validation
    'validation.closeEnough': 'Вкажіть числову правильну відповідь, щоб зберегти питання.',
    'validation.minTwoOptions': 'Додайте щонайменше два варіанти, щоб зберегти питання.',
    'validation.atLeastOneCorrect': 'Позначте принаймні один варіант як правильний.',
    'validation.exactlyOneCorrect': 'Позначте рівно один варіант як правильний.',
    'validation.uploadImage': 'Завантажте зображення, щоб зберегти питання.',
    'validation.missingTask': 'текст завдання («Що шукати?»)',
    'validation.missingImage': 'зображення',
    'validation.missingArea': 'принаймні одну позначену область',
    'validation.addMissing': 'Додайте {items}, щоб зберегти питання.',

    // Rule form
    'ruleForm.addRule': 'Додати правило',
    'ruleForm.updateRule': 'Оновити правило',
    'ruleForm.content': 'Вміст',
    'ruleForm.durationSeconds': 'Тривалість (секунд)',
    'ruleForm.ruleItem': 'Правило ({type})',
    'ruleForm.contentLabel': 'Вміст:',
    'ruleForm.durationLabel': 'Тривалість:',

    // Choice options editor
    'choice.multipleCorrect': 'Кілька правильних відповідей',
    'choice.editOption': 'Редагувати варіант №{number}',
    'choice.newOption': 'Новий варіант (текст, зображення, GIF, аудіо чи відео)',
    'choice.updateOption': 'Оновити варіант',
    'choice.addOption': 'Додати варіант',
    'choice.optionsHeadingSingle': 'Варіанти ({count}) — позначте правильний',
    'choice.optionsHeadingMultiple': 'Варіанти ({count}) — позначте правильні',
    'choice.noOptions': 'Варіантів ще немає. Додайте щонайменше два і позначте правильну відповідь.',
    'choice.correctAnswer': 'Правильна відповідь',
    'choice.markCorrect': 'Позначити як правильну',

    // Basic info form
    'basicInfo.title': 'Основна інформація',

    // Progressive reveal editor
    'reveal.hidingEffect': 'Ефект приховування',
    'reveal.blur': 'Розмиття',
    'reveal.pixelate': 'Пікселізація',
    'reveal.zoomOut': 'Віддалення',
    'reveal.speed': 'Швидкість відкриття',
    'reveal.linear': 'Лінійна (рівномірно)',
    'reveal.slowStart': 'Повільний старт (довше прихована)',
    'reveal.fastStart': 'Швидкий старт (багато відкривається одразу)',
    'reveal.duration': 'Тривалість відкриття (секунд)*',
    'reveal.durationHelper': 'Час до повного відкриття зображення, якщо ніхто не натисне кнопку',
    'reveal.preview': 'Перегляд відкриття',
    'reveal.confirmChangeImage': 'Змінити зображення?',
    'reveal.simulateProgress': 'Симуляція прогресу відкриття: {percent}%',

    // Game board
    'board.addNewTheme': 'Додати нову тему',
    'board.noThemes': 'Тем ще немає',
    'board.noThemesHint': 'Натисніть кнопку «+» нижче, щоб створити першу тему',

    // Theme row
    'theme.addQuestion': 'Додати питання',
    'theme.unnamed': 'Тема без назви',

    // Question form (legacy step form)
    'questionForm.questions': 'Питання',
    'questionForm.questionItem': 'Питання {id} ({type})',
    'questionForm.emptyQuestion': 'Порожнє питання',
    'questionForm.priceLabel': 'Ціна:',
    'questionForm.correctLabel': 'За правильну:',
    'questionForm.incorrectLabel': 'За неправильну:',
    'questionForm.rules': 'Правила',
    'questionForm.afterRoundRules': 'Правила після раунду',

    // Rounds form
    'rounds.title': 'Раунди та теми',
    'rounds.addNewRound': 'Додати новий раунд',
    'rounds.roundName': 'Назва раунду',
    'rounds.addRound': 'Додати раунд',
    'rounds.themeName': 'Назва теми',
    'rounds.themeDescription': 'Опис теми',
    'rounds.addTheme': 'Додати тему',

    // Pack form alerts
    'pack.uploadError': 'Помилка завантаження JSON-файлу. Переконайтеся, що це коректний файл паку.',
    'pack.repackError': 'Не вдалося перепакувати SIQ-пакет. {message}',
    'pack.repackErrorFallback': 'Переконайтеся, що SIQ-архів коректний.',

    // Review form
    'review.title': 'Перевірка паку',
    'review.name': 'Назва:',
    'review.author': 'Автор:',
    'review.theme': 'Тема:',
    'review.description': 'Опис:',
    'review.downloadJson': 'Завантажити JSON',
  },
};

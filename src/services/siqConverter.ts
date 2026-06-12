import JSZip from 'jszip';
import { Quiz, Price, Question, QuestionType, Round, Rule, RuleType, Theme } from '../types/quiz';

const DEFAULT_DURATION = 15;
const MEDIA_FOLDERS: Record<string, string> = {
  image: 'Images',
  audio: 'Audio',
  video: 'Video',
};

type MediaLoader = (type: string, fileName: string) => Promise<string | null>;

interface SIQSource {
  loadContentXml: () => Promise<string>;
  loadMedia: MediaLoader;
}

const safeDecodeURI = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizeName = (value: string): string => safeDecodeURI(value).replace(/\\/g, '/').trim().toLowerCase();

const getChildElements = (node: Element | Document, localName?: string): Element[] => {
  const elements = Array.from(node.childNodes).filter((child): child is Element => child.nodeType === Node.ELEMENT_NODE);
  if (!localName) return elements;
  return elements.filter((el) => el.localName === localName);
};

const getTextContent = (node?: Element | null): string | null => {
  const value = node?.textContent?.trim();
  return value && value.length > 0 ? value : null;
};

const guessMimeType = (fileName: string, fallback: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'mp3':
    case 'mpeg':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    default:
      return fallback;
  }
};

const bufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
};

const fetchFileAsBase64 = async (url: string, mimeType: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Could not load media: ${url} (${response.status})`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Data = bufferToBase64(arrayBuffer);
    return `data:${mimeType};base64,${base64Data}`;
  } catch (error) {
    console.warn(`Failed to convert media ${url} to base64`, error);
    return null;
  }
};

const buildMediaPath = (basePath: string, type: string, fileName: string): string => {
  const folder = MEDIA_FOLDERS[type] || '';
  const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  if (folder) {
    return `${normalizedBase}/${folder}/${fileName}`;
  }
  return `${normalizedBase}/${fileName}`;
};

const itemToRule = async (item: Element, loadMedia: MediaLoader): Promise<Rule | null> => {
  const rawType = item.getAttribute('type')?.toLowerCase();
  const contentText = getTextContent(item) || '';
  const mediaType = rawType === 'image' || rawType === 'audio' || rawType === 'video' ? rawType : null;

  if (mediaType) {
    const dataUrl = await loadMedia(mediaType, contentText);

    if (!dataUrl) {
      if (contentText) {
        return {
          type: RuleType.Embedded,
          content: contentText,
          duration: DEFAULT_DURATION,
        };
      }
      return null;
    }

    if (mediaType === 'audio') {
      return {
        type: RuleType.Embedded,
        content: `<audio controls autoplay src="${dataUrl}"></audio>`,
        duration: DEFAULT_DURATION,
      };
    }

    if (mediaType === 'video') {
      return {
        type: RuleType.Embedded,
        content: `<video controls autoplay style="max-width: 100%;" src="${dataUrl}"></video>`,
        duration: DEFAULT_DURATION,
      };
    }

    return {
      type: RuleType.Embedded,
      content: `<img src="${dataUrl}" alt="${contentText}" />`,
      duration: DEFAULT_DURATION,
    };
  }

  if (!contentText) {
    return null;
  }

  return {
    type: RuleType.Embedded,
    content: contentText,
    duration: DEFAULT_DURATION,
  };
};

const paramsToRules = async (paramNode: Element, loadMedia: MediaLoader): Promise<Rule[]> => {
  const rules: Rule[] = [];

  const nestedParams = getChildElements(paramNode, 'param');
  for (const nested of nestedParams) {
    const nestedRules = await paramsToRules(nested, loadMedia);
    rules.push(...nestedRules);
  }

  const items = getChildElements(paramNode, 'item');
  for (const item of items) {
    const rule = await itemToRule(item, loadMedia);
    if (rule) {
      rules.push(rule);
    }
  }

  return rules;
};

const extractPrice = (questionNode: Element, params: Element[]): Price => {
  const rawText = questionNode.getAttribute('price') || '0';
  const priceValue = Number(rawText);

  const numberSetParam = params.find(
    (param) => param.getAttribute('name') === 'price' && param.getAttribute('type') === 'numberSet'
  );
  const numberSetNode = numberSetParam ? getChildElements(numberSetParam, 'numberSet')[0] : undefined;

  const minimum = numberSetNode?.getAttribute('minimum') || null;
  const maximum = numberSetNode?.getAttribute('maximum') || null;
  const range = minimum && maximum ? `${minimum}-${maximum}` : 'null';

  return {
    text: rawText,
    correct: Number.isFinite(priceValue) ? priceValue : 0,
    incorrect: Number.isFinite(priceValue) ? -Math.abs(priceValue) : 0,
    random_range: range,
  };
};

const extractInfoText = (node: Element): string | null => {
  const infoNode = getChildElements(node, 'info')[0];
  const commentsNode = infoNode ? getChildElements(infoNode, 'comments')[0] : undefined;
  return getTextContent(commentsNode);
};

const convertQuestion = async (questionNode: Element, loadMedia: MediaLoader, nextId: { current: number }): Promise<Question> => {
  const paramsNode = getChildElements(questionNode, 'params')[0];
  const params = paramsNode ? getChildElements(paramsNode, 'param') : [];

  const questionContentParam = params.find((param) => param.getAttribute('name') === 'question');
  const answerContentParam = params.find((param) => param.getAttribute('name') === 'answer');

  const rules: Rule[] = [];
  if (questionContentParam) {
    rules.push(...(await paramsToRules(questionContentParam, loadMedia)));
  }

  const questionInfo = extractInfoText(questionNode);
  if (questionInfo) {
    rules.push({
      type: RuleType.Embedded,
      content: questionInfo,
      duration: DEFAULT_DURATION,
    });
  }

  const afterRound: Rule[] = [];
  if (answerContentParam) {
    afterRound.push(...(await paramsToRules(answerContentParam, loadMedia)));
  }

  const rightNode = getChildElements(questionNode, 'right')[0];
  const answers = rightNode ? getChildElements(rightNode, 'answer') : [];
  answers.forEach((answer) => {
    const content = getTextContent(answer);
    if (content) {
      afterRound.push({
        type: RuleType.Embedded,
        content,
        duration: DEFAULT_DURATION,
      });
    }
  });

  const typeAttribute = questionNode.getAttribute('type')?.toLowerCase();
  let type: QuestionType = QuestionType.Normal;
  if (typeAttribute === 'secret') {
    type = QuestionType.Secret;
  } else if (typeAttribute === 'empty') {
    type = QuestionType.Empty;
  }

  const price = extractPrice(questionNode, params);

  const question: Question = {
    id: nextId.current++,
    type,
    price,
    rules,
    after_round: afterRound,
  };

  return question;
};

const convertTheme = async (themeNode: Element, loadMedia: MediaLoader, nextQuestionId: { current: number }, nextThemeId: { current: number }): Promise<Theme> => {
  const name = themeNode.getAttribute('name') || 'Untitled Theme';
  const description = extractInfoText(themeNode) || undefined;
  const questionsNode = getChildElements(themeNode, 'questions')[0];
  const questionNodes = questionsNode ? getChildElements(questionsNode, 'question') : [];

  const questions: Question[] = [];
  for (const questionNode of questionNodes) {
    questions.push(await convertQuestion(questionNode, loadMedia, nextQuestionId));
  }

  return {
    id: nextThemeId.current++,
    name,
    description,
    ordered: false,
    questions,
  };
};

const convertRound = async (roundNode: Element, loadMedia: MediaLoader, nextQuestionId: { current: number }, nextThemeId: { current: number }): Promise<Round> => {
  const name = roundNode.getAttribute('name') || 'Round';
  const themesNode = getChildElements(roundNode, 'themes')[0];
  const themeNodes = themesNode ? getChildElements(themesNode, 'theme') : [];

  const themes: Theme[] = [];
  for (const themeNode of themeNodes) {
    themes.push(await convertTheme(themeNode, loadMedia, nextQuestionId, nextThemeId));
  }

  return {
    name,
    themes,
  };
};

const convertDocumentToQuiz = async (doc: Document, loadMedia: MediaLoader): Promise<Quiz> => {
  const packageNode = doc.documentElement;
  if (packageNode.localName !== 'package') {
    throw new Error(`Unexpected SIQ root element (${packageNode.localName}).`);
  }
  const infoNode = getChildElements(packageNode, 'info')[0];
  const authorsNode = infoNode ? getChildElements(infoNode, 'authors')[0] : undefined;
  const author = getTextContent(getChildElements(authorsNode || packageNode, 'author')[0]) || 'SIQ Import';
  const quizName = packageNode.getAttribute('name') || 'Converted quiz';

  const roundsNode = getChildElements(packageNode, 'rounds')[0];
  const roundNodes = roundsNode ? getChildElements(roundsNode, 'round') : [];
  if (!roundNodes.length) {
    throw new Error('No rounds found in SIQ package.');
  }

  const nextQuestionId = { current: 1 };
  const nextThemeId = { current: 1 };
  const rounds: Round[] = [];
  for (const roundNode of roundNodes) {
    rounds.push(await convertRound(roundNode, loadMedia, nextQuestionId, nextThemeId));
  }

  return {
    author,
    name: quizName,
    rounds,
  };
};

const parseSIQ = async ({ loadContentXml, loadMedia }: SIQSource): Promise<Quiz> => {
  const xmlText = await loadContentXml();
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');

  const parserErrors = doc.getElementsByTagName('parsererror');
  if (parserErrors && parserErrors.length > 0) {
    throw new Error('Invalid SIQ XML.');
  }

  return convertDocumentToQuiz(doc, loadMedia);
};

export const convertSIQFromPublicDir = async (siqBasePath = '/siq'): Promise<Quiz> => {
  const normalizedBase = siqBasePath.endsWith('/') ? siqBasePath.slice(0, -1) : siqBasePath;
  const contentUrl = `${normalizedBase}/content.xml`;

  const loadContentXml = async () => {
    const xmlResponse = await fetch(contentUrl);
    if (!xmlResponse.ok) {
      throw new Error(`Failed to load SIQ content from ${contentUrl}`);
    }
    return xmlResponse.text();
  };

  const loadMedia: MediaLoader = async (type, fileName) => {
    const path = buildMediaPath(normalizedBase, type, fileName);
    const mime = guessMimeType(fileName, `${type}/*`);
    return fetchFileAsBase64(path, mime);
  };

  return parseSIQ({ loadContentXml, loadMedia });
};

export const convertSIQFromFile = async (file: File): Promise<Quiz> => {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const contentMatches = zip.file(/(^|\/)content\.xml$/i);
  const contentEntry = contentMatches[0];
  if (!contentEntry) {
    throw new Error('content.xml not found in SIQ archive');
  }

  const loadContentXml = async () => contentEntry.async('text');

  const findZipEntry = (preferredFolder: string, fileName: string): JSZip.JSZipObject | null => {
    const nameVariants = Array.from(
      new Set<string>([
        fileName,
        safeDecodeURI(fileName),
        encodeURI(safeDecodeURI(fileName)),
        safeDecodeURI(fileName).trim(),
        encodeURI(safeDecodeURI(fileName).trim()),
      ])
    );

    const folderVariants = [preferredFolder, preferredFolder.toLowerCase(), ''];
    for (const folder of folderVariants) {
      for (const name of nameVariants) {
        const candidate = folder ? `${folder}/${name}` : name;
        const entry = zip.file(candidate);
        if (entry) return entry;
      }
    }

    const targetNormalized = normalizeName(fileName.split('/').pop() || fileName);
    const candidates = zip.filter((relativePath, entry) => {
      if (entry.dir) return false;
      if (relativePath.includes('Zone.Identifier')) return false;
      const base = relativePath.split('/').pop() || relativePath;
      return normalizeName(base) === targetNormalized;
    });

    return candidates[0] || null;
  };

  const loadMedia: MediaLoader = async (type, fileName) => {
    const preferredFolder = MEDIA_FOLDERS[type];
    const matchingEntry = findZipEntry(preferredFolder, fileName);

    if (!matchingEntry) {
      console.warn(`Media file not found in SIQ archive: ${fileName}`);
      return null;
    }

    const base64 = await matchingEntry.async('base64');
    const mime = guessMimeType(fileName, `${type}/*`);
    return `data:${mime};base64,${base64}`;
  };

  return parseSIQ({ loadContentXml, loadMedia });
};

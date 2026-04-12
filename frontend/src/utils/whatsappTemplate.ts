import AsyncStorage from "@react-native-async-storage/async-storage";

export const WHATSAPP_TEMPLATE_STORAGE_KEY = "pm_whatsapp_message_template";

export const DEFAULT_WHATSAPP_MESSAGE_TEMPLATE = [
  "Hello {name},",
  "Your pending amount is ₹{totalDue}.",
  "Unpaid bills: {unpaidBills}.",
  "Please clear your due payment at the earliest.",
  "Thank you."
].join("\n");

export const WHATSAPP_TEMPLATE_PLACEHOLDERS =
  "{name}, {mobile}, {totalDue}, {unpaidBills}, {creditBalance}, {date}";

export interface WhatsAppTemplateValues {
  name: string;
  mobile: string;
  totalDue: string;
  unpaidBills: string;
  creditBalance: string;
  date: string;
}

const TEMPLATE_KEYS: Array<keyof WhatsAppTemplateValues> = [
  "name",
  "mobile",
  "totalDue",
  "unpaidBills",
  "creditBalance",
  "date"
];

export const loadWhatsAppTemplate = async (): Promise<string> => {
  const savedTemplate = await AsyncStorage.getItem(WHATSAPP_TEMPLATE_STORAGE_KEY);
  if (savedTemplate && savedTemplate.trim()) {
    return savedTemplate;
  }
  return DEFAULT_WHATSAPP_MESSAGE_TEMPLATE;
};

export const saveWhatsAppTemplate = async (template: string): Promise<string> => {
  const nextTemplate = template.trim() ? template : DEFAULT_WHATSAPP_MESSAGE_TEMPLATE;
  await AsyncStorage.setItem(WHATSAPP_TEMPLATE_STORAGE_KEY, nextTemplate);
  return nextTemplate;
};

export const resolveWhatsAppTemplate = (
  template: string,
  values: WhatsAppTemplateValues
): string => {
  let resolvedTemplate = template;

  TEMPLATE_KEYS.forEach((key) => {
    const value = values[key];
    resolvedTemplate = resolvedTemplate.replace(new RegExp(`\\{${key}\\}`, "gi"), value);
  });

  return resolvedTemplate;
};

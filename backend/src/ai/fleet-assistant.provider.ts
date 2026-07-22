export type FleetAssistantAction = { label: string; href: string } | null;

export type FleetAssistantResponse = {
  title: string;
  text: string;
  table: Array<{ label: string; value: string }>;
  action: FleetAssistantAction;
};

export type FleetAssistantContext = {
  requestId: string;
  userId: string;
  role: string;
};

export interface FleetAssistantProvider {
  readonly name: 'builtin' | 'openai';
  isAvailable(): boolean;
  ask(message: string, context: FleetAssistantContext): Promise<FleetAssistantResponse>;
}

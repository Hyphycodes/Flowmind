import { generateObject, generateText, streamText, type LanguageModel } from "ai";
import { z } from "zod";
import { getModelClient } from "./client";

export async function generateStructuredObject<TSchema extends z.ZodTypeAny>(options: {
  modelId: string;
  schema: TSchema;
  system?: string;
  prompt: string;
  temperature?: number;
  maxRetries?: number;
}) {
  return generateObject({
    model: getModelClient(options.modelId) as LanguageModel,
    schema: options.schema,
    system: options.system,
    prompt: options.prompt,
    temperature: options.temperature,
    maxRetries: options.maxRetries ?? 1,
  });
}

export async function generateTextWithModel(options: {
  modelId: string;
  system?: string;
  prompt: string;
  temperature?: number;
}) {
  return generateText({
    model: getModelClient(options.modelId) as LanguageModel,
    system: options.system,
    prompt: options.prompt,
    temperature: options.temperature,
  });
}

export function streamTextWithModel(options: {
  modelId: string;
  system?: string;
  prompt: string;
  temperature?: number;
}) {
  return streamText({
    model: getModelClient(options.modelId) as LanguageModel,
    system: options.system,
    prompt: options.prompt,
    temperature: options.temperature,
  });
}

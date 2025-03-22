import { createClient } from "redis";
import { Account } from "../types/account";
import { JsonRpcRequest } from "../types/json-rpc-request";

const redis = await createClient({ url: process.env.REDIS_URL }).connect();

if (!redis.isOpen) {
  await redis.connect();
}

export const setSessionAccount = async (
  sessionId: string,
  account: Account
) => {
  await redis.set(`${sessionId}:account`, JSON.stringify(account));
};

export const getSessionAccount = async (sessionId: string) => {
  const data = await redis.get(`${sessionId}:account`);
  if (!data) {
    throw new Error("Session account not found");
  }
  return JSON.parse(data) as Account;
};

export const setSessionRequest = async (
  sessionId: string,
  request: JsonRpcRequest
) => {
  await redis.set(`${sessionId}:request`, JSON.stringify(request));
};

export const getSessionRequest = async (sessionId: string) => {
  const data = await redis.get(`${sessionId}:request`);
  if (!data) {
    throw new Error("Session request not found");
  }
  return JSON.parse(data) as JsonRpcRequest;
};

export const deleteSessionRequest = async (sessionId: string) => {
  const deleted = await redis.del(`${sessionId}:request`);
  if (!deleted) {
    throw new Error("Failed to delete session request or it did not exist");
  }
};

export const setSessionResponse = async (
  sessionId: string,
  response: string
) => {
  await redis.set(`${sessionId}:response`, response);
};

export const getSessionResponse = async (sessionId: string) => {
  const data = await redis.get(`${sessionId}:response`);
  if (!data) {
    throw new Error("Session response not found");
  }
  return data;
};

export const deleteSessionResponse = async (sessionId: string) => {
  const deleted = await redis.del(`${sessionId}:response`);
  if (!deleted) {
    throw new Error("Failed to delete session response or it did not exist");
  }
};

export const waitForSessionResponse = async (
  sessionId: string,
  timeout = 60000,
  interval = 1000
): Promise<any> => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const response = await getSessionResponse(sessionId).catch(() => undefined);
    if (response) {
      return response;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error("Timeout waiting for session response");
};

import {
  FunctionEventHandler,
  FunctionTypeEnum,
} from "@contentful/node-apps-toolkit";
import { AppInstallationParameters } from "../src/types";

export type EventHandler = FunctionEventHandler<
  FunctionTypeEnum,
  AppInstallationParameters
>;
export type QueryHandler = FunctionEventHandler<
  FunctionTypeEnum.GraphqlQuery,
  AppInstallationParameters
>;
export type MappingHandler = FunctionEventHandler<
  FunctionTypeEnum.GraphqlResourceTypeMapping,
  AppInstallationParameters
>;
export type ResourcesSearchHandler =
  FunctionEventHandler<FunctionTypeEnum.ResourcesSearch>;
export type ResourcesLookupHandler =
  FunctionEventHandler<FunctionTypeEnum.ResourcesLookup>;

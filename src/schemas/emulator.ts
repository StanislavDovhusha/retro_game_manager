import { z } from 'zod';
import type { EmulatorLaunchRequest } from '../models/index.ts';
import { defineInput } from '../middlewares/validate.ts';
import { relPath } from './common.ts';
import type { Accepts, Assert } from './common.ts';

const statusQuery = z.object({ rel: relPath.optional() });
const launchBody = z.object({ rel: relPath });

export const emulatorStatusInput = defineInput({ query: statusQuery });
export const emulatorLaunchInput = defineInput({ body: launchBody });

export type _EmulatorChecks = [Assert<Accepts<typeof launchBody, EmulatorLaunchRequest>>];

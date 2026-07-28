import { describe, expect, it } from 'vitest';
import { createBlankProject } from '@our-stage/project-schema';
import { MockAiDirectorProvider, parseProjectPatch } from '@our-stage/ai-director';
describe('AI director',()=>{it('returns a schema-valid honest patch without assets',async()=>{const project=createBlankProject(),patch=await new MockAiDirectorProvider().createComposition(project,'wave',{motions:[],cameraPresets:['medium'],renderPresets:[]});expect(parseProjectPatch(patch).baseProjectRevision).toBe(project.revision);expect(patch.warnings?.length).toBeGreaterThan(0)})});

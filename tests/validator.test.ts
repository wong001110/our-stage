import { describe, expect, it } from 'vitest';
import { createBlankProject } from '@our-stage/project-schema';
import { validateProject } from '@our-stage/validator';
describe('project validator',()=>{it('reports an empty composition without blocking it',()=>{const report=validateProject(createBlankProject(),null,new Map());expect(report.status).toBe('pass-with-warnings');expect(report.warnings.some(item=>item.code==='NO_MOTION_CLIP')).toBe(true)})});

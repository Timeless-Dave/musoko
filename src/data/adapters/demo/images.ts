import { GatewayError } from '../../ports/errors';
import type { ImageStore } from '../../ports/images';

export function createDemoImages(): ImageStore {
  return {
    async save() {
      throw new GatewayError('not_implemented', 'Photo upload arrives in a later step.');
    },
    async remove() {
      throw new GatewayError('not_implemented', 'Photo removal arrives in a later step.');
    },
  };
}

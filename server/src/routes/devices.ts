import { Router } from 'express';
import { deviceNameSchema, pairInputSchema, type DeviceNameInput, type DeviceStatus, type PairInput } from '@tiny-pos/shared';
import { counterOnly, setDeviceCookie } from '../middleware/device-gate.js';
import { intParam, validateBody } from '../middleware/validate.js';
import type { DevicesService } from '../services/devices.js';

/** /api/device: máy đang gọi hỏi trạng thái và gửi mã ghép (mở cả cho máy chưa ghép, xem deviceGate). */
export function deviceRouter(devices: DevicesService): Router {
  const r = Router();
  r.get('/', (_req, res) => res.json(res.locals['device'] as DeviceStatus));
  r.post('/pair', validateBody(pairInputSchema), (req, res) => {
    const { token, device } = devices.pair((req.body as PairInput).code, req.headers['user-agent']);
    setDeviceCookie(res, token);
    res.status(201).json({ device });
  });
  return r;
}

/** /api/devices: chỉ máy quầy – tạo mã ghép, danh sách, đổi tên, gỡ. */
export function devicesRouter(devices: DevicesService): Router {
  const r = Router();
  r.use(counterOnly);
  r.post('/pairing', (_req, res) => res.json(devices.startPairing()));
  r.get('/', (_req, res) => res.json(devices.list()));
  r.patch('/:id', validateBody(deviceNameSchema), (req, res) => res.json(devices.rename(intParam(req, 'id'), (req.body as DeviceNameInput).name)));
  r.delete('/:id', (req, res) => {
    devices.revoke(intParam(req, 'id'));
    res.status(204).end();
  });
  return r;
}

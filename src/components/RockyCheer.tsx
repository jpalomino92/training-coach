/* Rocky da ánimo: festeja, saca bíceps o te echa de menos, con un saltito al aparecer. */
import type { CheerPose } from '../domain/cheer';
import { ROCKY } from '../domain/ghost';
import flex from '../assets/rocky/flex.webp';
import party from '../assets/rocky/party.webp';
import sad from '../assets/rocky/sad.webp';

const POSES: Record<CheerPose, string> = { party, flex, sad };
const LABEL: Record<CheerPose, string> = { party: 'festeja', flex: 'saca bíceps', sad: 'está sentado y triste' };

export function RockyCheer({ pose, text, big }: { pose: CheerPose; text: string; big?: boolean }) {
  return (
    <div className={`cheer${big ? ' big' : ''}`}>
      <img className={`cheer-img ${pose}`} src={POSES[pose]} alt={`${ROCKY} ${LABEL[pose]}`} draggable={false} />
      <p className="cheer-say">{text}</p>
    </div>
  );
}

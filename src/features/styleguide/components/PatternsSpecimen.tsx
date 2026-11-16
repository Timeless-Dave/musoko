import { Button } from '@/design-system/primitives';
import { EmptyState, PageHeader, PhotoFrame, StatFigure, StatGrid } from '@/design-system/patterns';
import { Specimen } from './Spread';

export function PatternsSpecimen() {
  return (
    <>
      <Specimen name="PageHeader">
        <PageHeader
          back={{ href: '/styleguide', label: 'All farms' }}
          title="Delta Greens Farm"
          lead="Vegetables and eggs from a family plot outside Helena-West Helena."
          actions={<Button variant="secondary">See all farms</Button>}
        />
      </Specimen>
      <Specimen name="EmptyState">
        <EmptyState
          sentence="No farms in Clarendon yet."
          action={<Button variant="secondary">See farms in nearby towns</Button>}
        />
      </Specimen>
      <Specimen name="StatFigure and StatGrid" full>
        <StatGrid>
          <StatFigure figure="128" label="Searches this month" />
          <StatFigure figure="14" label="Inquiries" />
          <StatFigure figure="0" label="Searches with no results in Clarendon" note="Most asked for: okra" />
          <StatFigure insufficient="Not enough searches yet to show this." label="Searches in Lake Village this month" />
        </StatGrid>
      </Specimen>
      <Specimen name="PhotoFrame (specimen mode)" full>
        <div className="photo-grid">
          <PhotoFrame ratio="4:3" specimen="Photograph, 4:3" />
          <PhotoFrame ratio="3:2" specimen="Photograph, 3:2" />
          <PhotoFrame ratio="1:1" specimen="Photograph, 1:1" />
          <PhotoFrame ratio="4:5" specimen="Photograph, 4:5" />
        </div>
      </Specimen>
    </>
  );
}


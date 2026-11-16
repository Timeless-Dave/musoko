'use client';

import { useState } from 'react';
import { copy } from '@/content/copy';
import {
  Button,
  Dialog,
  Field,
  MetaLine,
  Section,
  Select,
  Sheet,
  Stack,
  StatusMark,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tag,
} from '@/design-system/primitives';
import { DemoMark } from '@/features/demo';
import { sg } from '../copy';
import { Specimen } from './Spread';

function ButtonRows() {
  const states = [undefined, 'hover', 'focus', 'pressed'] as const;
  return (
    <div className="stack-6">
      {states.map((state) => (
        <div className="row-wrap" key={state ?? 'rest'} data-state-preview={state}>
          <p className="meta state-label">{state ?? 'rest'}</p>
          <Button data-state-preview={state}>Contact farmer</Button>
          <Button variant="secondary" data-state-preview={state}>
            See all farms
          </Button>
          <Button variant="link" data-state-preview={state}>
            How Musoko works
          </Button>
        </div>
      ))}
      <div className="row-wrap">
        <p className="meta state-label">disabled</p>
        <Button disabled>Contact farmer</Button>
        <Button variant="secondary" disabled>
          See all farms
        </Button>
        <Button variant="link" disabled>
          How Musoko works
        </Button>
      </div>
      <div className="row-wrap">
        <p className="meta state-label">loading</p>
        <Button loading loadingLabel={copy.common.saving}>
          Contact farmer
        </Button>
        <Button variant="secondary" loading loadingLabel={copy.common.saving}>
          See all farms
        </Button>
      </div>
    </div>
  );
}

function Fields() {
  return (
    <div className="stack-6">
      <Field label="Price in dollars" hint="For example 4.50" name="price" />
      <Field label="Farm name" name="focused" data-state-preview="focus" defaultValue="Delta Greens Farm" />
      <Field label="Price in dollars" name="price-error" error="Enter a price, for example 4.50." defaultValue="four" />
      <Field label="Farm name" name="disabled" disabled defaultValue="Delta Greens Farm" />
      <Field label="Website" optionalLabel="optional" name="website" />
      <Field label="About the farm" multiline name="about" hint="A few sentences in your own words." />
    </div>
  );
}

function Selects() {
  const options = (
    <>
      <option value="">Choose a community</option>
      {sg.communities.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </>
  );
  return (
    <div className="stack-6">
      <Select label="Community" defaultValue="">
        {options}
      </Select>
      <Select label="Community" error="Choose the community you pick up in." defaultValue="">
        {options}
      </Select>
      <Select label="Community" disabled defaultValue="Pine Bluff">
        {options}
      </Select>
    </div>
  );
}

function DialogAndSheet() {
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  return (
    <div className="row-wrap">
      <Button variant="secondary" onClick={() => setDialog(true)}>
        Open a dialog
      </Button>
      <Dialog
        open={dialog}
        onOpenChange={setDialog}
        title="Remove this listing?"
        description="It will stop showing to buyers."
        closeLabel={copy.common.close}
        actions={
          <>
            <Button onClick={() => setDialog(false)}>Remove listing</Button>
            <Button variant="secondary" onClick={() => setDialog(false)}>
              {copy.common.cancel}
            </Button>
          </>
        }
      />
      <Button variant="secondary" onClick={() => setSheet(true)}>
        Open a sheet
      </Button>
      <Sheet open={sheet} onOpenChange={setSheet} title="Filters" closeLabel={copy.common.close}>
        <div className="stack-6">
          <Field label="Most you want to pay, in dollars" name="max" />
          <Field label="Town" name="town" />
          <Button block onClick={() => setSheet(false)}>
            Show results
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

export function PrimitivesSpecimen() {
  return (
    <>
      <Specimen name="Button">
        <ButtonRows />
      </Specimen>
      <Specimen name="Field">
        <Fields />
      </Specimen>
      <Specimen name="Select">
        <Selects />
      </Specimen>
      <Specimen name="Dialog and Sheet">
        <DialogAndSheet />
      </Specimen>
      <Specimen name="Tabs">
        <Tabs defaultValue="products">
          <TabsList aria-label="Browse by">
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="farms">Farms</TabsTrigger>
            <TabsTrigger value="markets">Markets</TabsTrigger>
            <TabsTrigger value="events" disabled>
              Events
            </TabsTrigger>
          </TabsList>
          <TabsContent value="products">Fresh food from farms near you, with the price and the pickup place.</TabsContent>
          <TabsContent value="farms">The farms behind the food, by town.</TabsContent>
          <TabsContent value="markets">Where and when the local markets run.</TabsContent>
        </Tabs>
      </Specimen>
      <Specimen name="Tag">
        <div className="row-wrap">
          <Tag>Open to wholesale</Tag>
          <Tag quiet>Farmer-reported</Tag>
        </div>
      </Specimen>
      <Specimen name="Stack">
        <div className="stack-6">
          <Stack direction="row" gap={4} wrap>
            <span className="meta">gap 4</span>
            <span className="meta">in a</span>
            <span className="meta">row</span>
          </Stack>
          <Stack gap={2}>
            <span className="meta">gap 2</span>
            <span className="meta">in a</span>
            <span className="meta">column</span>
          </Stack>
        </div>
      </Specimen>
      <Specimen name="Section, both tones" full>
        <div className="section-stack">
          <Section tone="ground" pad="none" contained={false} className="section-specimen">
            <p className="section-specimen__label">Ground section. The letters behind change ink at the edge.</p>
          </Section>
          <Section tone="inverse" pad="none" contained={false} className="section-specimen">
            <p className="section-specimen__label">Inverse section.</p>
          </Section>
          <Section tone="ground" pad="none" contained={false} className="section-specimen">
            <p className="section-specimen__label">Ground again.</p>
          </Section>
        </div>
      </Specimen>
      <Specimen name="StatusMark">
        <div className="stack-6">
          {(
            [
              ['full', copy.availability.available_now],
              ['half', copy.availability.coming_soon],
              ['hollow', copy.availability.unconfirmed],
            ] as const
          ).map(([fill, words]) => (
            <div className="status-row" key={fill}>
              <span className="status-line status-line--meta">
                <StatusMark fill={fill} size="meta" />
                {words}
              </span>
              <span className="status-line status-line--body">
                <StatusMark fill={fill} size="body" />
                {words}
              </span>
            </div>
          ))}
        </div>
      </Specimen>
      <Specimen name="MetaLine">
        <div className="stack-6">
          <MetaLine>
            {'About 20 lb'}
            {'Updated 3 days ago'}
            <DemoMark />
          </MetaLine>
          <MetaLine>
            {'Pick up Saturday at the Cherry Street market in Helena-West Helena'}
            {'Updated 3 days ago'}
            {'Farmer-reported'}
            <DemoMark />
          </MetaLine>
        </div>
      </Specimen>
    </>
  );
}

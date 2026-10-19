import { adminDashboardsById } from '../../siteContent'
import { Axolotl, Cat, Frog, FlowerGarland, Waterfall } from './critters'
import { RelationshipClock } from './RelationshipClock'
import { Timeline } from './Timeline'
import './ciara.css'

export function CiaraDashboard({ idToken }: { idToken: string }) {
  const { title } = adminDashboardsById.ciara

  return (
    <div className="ciara-page">
      <header className="ciara-hero">
        <FlowerGarland />
        <p className="ciara-kicker">our little corner</p>
        <h1 className="ciara-title">{title}</h1>

        <div className="ciara-scene">
          <Waterfall />
          <div className="ciara-pond">
            <Frog className="ciara-frog ciara-frog-a" />
            <Frog className="ciara-frog ciara-frog-b" />
            <Frog className="ciara-frog ciara-frog-c" />
            <figure className="ciara-critter ciara-axo-barbie">
              <Axolotl color="pink" />
              <figcaption>Barbie</figcaption>
            </figure>
            <figure className="ciara-critter ciara-axo-ken">
              <Axolotl color="blue" flip />
              <figcaption>Ken</figcaption>
            </figure>
          </div>
        </div>
      </header>

      <main className="ciara-body">
        <div className="ciara-perch">
          <figure className="ciara-critter ciara-cat ciara-cat-midnight">
            <Cat coat="black" eyes="yellow" />
            <figcaption>Midnight</figcaption>
          </figure>
          <figure className="ciara-critter ciara-cat ciara-cat-inky">
            <Cat coat="black" eyes="green" closedEyes />
            <figcaption>Inky</figcaption>
          </figure>
          <RelationshipClock />
        </div>

        <div className="ciara-perch">
          <figure className="ciara-critter ciara-cat ciara-cat-pirouette">
            <Cat coat="white" eyes="blue" />
            <figcaption>Pirouette</figcaption>
          </figure>
          <Timeline idToken={idToken} />
        </div>
      </main>
    </div>
  )
}

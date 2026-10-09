import {
  createRoute,
  Link,
  notFound,
  redirect,
  type AnyRoute,
} from "@tanstack/react-router";
import { authenticatedRouteTree, productRootRoute } from "@vita-os/application";

import { DesignSystemPage } from "@/system/design-system-page";

import {
  CompareVariants,
  PrototypeStage,
  readPrototypeSearch,
} from "./prototype-stage";
import { findPrototype, prototypes } from "./prototypes";
import { scenarios } from "./scenarios";

/**
 * The lab's own pages, beside the product's routes: `/lab` lists what there is
 * to open, `/lab/system` is the design system, `/lab/<prototype>` opens one
 * prototype and `/lab/<prototype>/compare` lays its variants side by side.
 * Their static `lab` segment wins over the product's Area slugs.
 */
const labRoute = createRoute({
  getParentRoute: () => productRootRoute,
  path: "/lab",
  component: LabIndexPage,
});

const systemRoute = createRoute({
  getParentRoute: () => productRootRoute,
  path: "/lab/system",
  component: DesignSystemPage,
});

function loadPrototype({ params }: { params: { prototypeId: string } }) {
  const entry = findPrototype(params.prototypeId);
  if (entry === undefined) throw notFound();
  return entry;
}

const prototypeRoute = createRoute({
  getParentRoute: () => productRootRoute,
  path: "/lab/$prototypeId",
  validateSearch: readPrototypeSearch,
  // A prototype that wants the product's shell lives under it.
  beforeLoad: ({ params, search }) => {
    if (findPrototype(params.prototypeId)?.prototype.shell) {
      // Added at runtime, so the router's types do not know this address.
      const query =
        search.variant === undefined
          ? ""
          : `?variant=${encodeURIComponent(search.variant)}`;
      throw redirect({ href: `/lab/${params.prototypeId}/app${query}` });
    }
  },
  loader: loadPrototype,
  component: function PrototypePage() {
    const { id, prototype } = prototypeRoute.useLoaderData();
    return (
      <PrototypeStage
        id={id}
        prototype={prototype}
        search={prototypeRoute.useSearch()}
      />
    );
  },
  notFoundComponent: NoSuchPrototype,
});

/**
 * The same, inside the product's authenticated layout, so a whole-screen
 * direction sits in the real chrome and can summon the real Thread pane.
 */
const shellPrototypeRoute = createRoute({
  getParentRoute: () => authenticatedRouteTree,
  path: "/lab/$prototypeId/app",
  validateSearch: readPrototypeSearch,
  loader: loadPrototype,
  component: function ShellPrototypePage() {
    const { id, prototype } = shellPrototypeRoute.useLoaderData();
    return (
      <PrototypeStage
        id={id}
        prototype={prototype}
        search={shellPrototypeRoute.useSearch()}
      />
    );
  },
  notFoundComponent: NoSuchPrototype,
});

const compareRoute = createRoute({
  getParentRoute: () => productRootRoute,
  path: "/lab/$prototypeId/compare",
  loader: loadPrototype,
  component: function ComparePage() {
    const { id, prototype } = compareRoute.useLoaderData();
    return <CompareVariants id={id} prototype={prototype} />;
  },
  notFoundComponent: NoSuchPrototype,
});

/**
 * The product's route tree with the lab's pages added: beside the product's
 * routes, and one under its authenticated layout. `addChildren` replaces a
 * route's children, so the product's own are passed along.
 */
export function labRouteTree() {
  // Hot reloading runs this again; drop the copy the last run added.
  const productChildren = (
    authenticatedRouteTree.children as unknown as AnyRoute[]
  ).filter((route) => pathOf(route) !== pathOf(shellPrototypeRoute));
  authenticatedRouteTree.addChildren([...productChildren, shellPrototypeRoute]);
  return productRootRoute.addChildren([
    authenticatedRouteTree,
    labRoute,
    systemRoute,
    prototypeRoute,
    compareRoute,
  ]);
}

function pathOf(route: AnyRoute): unknown {
  return (route.options as { path?: string }).path;
}

function NoSuchPrototype() {
  return (
    <LabPage title="No such prototype">
      <Link to="/lab" className="underline">
        Back to the lab
      </Link>
    </LabPage>
  );
}

function LabIndexPage() {
  return (
    <LabPage title="Vita OS lab">
      <p className="text-muted-foreground">
        The real app on in-memory data. Pick a scenario and latency from the
        flask button in the corner; nothing here touches the API.
      </p>

      <Section title="Open">
        <Link to="/" className={entry}>
          <EntryText title="The app" description="Every product screen." />
        </Link>
        <Link to="/lab/system" className={entry}>
          <EntryText
            title="Design system"
            description="Tokens and the shared components of @vita-os/ui."
          />
        </Link>
      </Section>

      <Section title="Prototypes">
        {prototypes.map(({ id, prototype }) => (
          <div key={id} className="flex items-start gap-2">
            <Link
              to="/lab/$prototypeId"
              params={{ prototypeId: id }}
              className={`${entry} flex-1`}
            >
              <EntryText
                title={prototype.title}
                description={
                  prototype.variants.length > 1
                    ? `${prototype.description} ${prototype.variants.length} variants.`
                    : prototype.description
                }
              />
            </Link>
            {prototype.variants.length > 1 && (
              <Link
                to="/lab/$prototypeId/compare"
                params={{ prototypeId: id }}
                className="mt-2 rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              >
                Compare
              </Link>
            )}
          </div>
        ))}
      </Section>

      <Section title="Scenarios">
        {scenarios.map((scenario) => (
          <div key={scenario.id} className="px-3 py-2">
            <p className="font-medium">{scenario.name}</p>
            <p className="text-sm text-muted-foreground">
              {scenario.description}
            </p>
          </div>
        ))}
      </Section>
    </LabPage>
  );
}

function LabPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
      <h1 className="font-heading text-2xl font-bold tracking-tight">
        {title}
      </h1>
      {children}
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

const entry = "rounded-xl px-3 py-2 hover:bg-muted/60";

function EntryText({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </>
  );
}

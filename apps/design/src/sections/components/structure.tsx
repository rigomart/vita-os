import { Badge } from "@vita-os/ui/components/badge";
import { Button } from "@vita-os/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@vita-os/ui/components/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@vita-os/ui/components/item";
import { Separator } from "@vita-os/ui/components/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@vita-os/ui/components/tabs";
import { CheckCircle2, ChevronsUpDown, Circle, Target } from "lucide-react";

import { Example, Group } from "./group";

export function StructureGroup() {
  return (
    <Group title="Structure">
      <Example label="Card">
        <Card className="w-80">
          <CardHeader>
            <CardTitle>Deep Work Q3</CardTitle>
            <CardDescription>4 tasks · 2 threads open</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="size-4" />
              Goal: ship the design showcase
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button size="sm">Open project</Button>
            <Badge variant="secondary">On track</Badge>
          </CardFooter>
        </Card>
      </Example>

      <Example label="Tabs">
        <Tabs defaultValue="today" className="w-80">
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="someday">Someday</TabsTrigger>
          </TabsList>
          <TabsContent
            value="today"
            className="pt-3 text-sm text-muted-foreground"
          >
            3 tasks scheduled for today.
          </TabsContent>
          <TabsContent
            value="upcoming"
            className="pt-3 text-sm text-muted-foreground"
          >
            5 tasks in the next 7 days.
          </TabsContent>
          <TabsContent
            value="someday"
            className="pt-3 text-sm text-muted-foreground"
          >
            12 tasks parked without a date.
          </TabsContent>
        </Tabs>
      </Example>

      <Example label="Separator">
        <div className="w-64 space-y-3">
          <p className="text-sm">Personal OS</p>
          <Separator />
          <p className="text-sm text-muted-foreground">Health Reset</p>
        </div>
        <div className="flex h-8 items-center gap-3 text-sm text-muted-foreground">
          <span>Areas</span>
          <Separator orientation="vertical" />
          <span>Threads</span>
          <Separator orientation="vertical" />
          <span>Goals</span>
        </div>
      </Example>

      <Example label="Item">
        <ItemGroup className="w-96">
          <Item variant="outline">
            <ItemMedia variant="icon">
              <CheckCircle2 className="text-primary" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Write the weekly review</ItemTitle>
              <ItemDescription>
                Personal OS · Completed yesterday
              </ItemDescription>
            </ItemContent>
          </Item>
          <Item variant="outline">
            <ItemMedia variant="icon">
              <Circle />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Book physio follow-up</ItemTitle>
              <ItemDescription>Health Reset · Due tomorrow</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Badge variant="outline">High</Badge>
            </ItemActions>
          </Item>
        </ItemGroup>
      </Example>

      <Example label="Collapsible">
        <Collapsible className="w-72 space-y-2">
          <CollapsibleTrigger
            render={
              <Button variant="ghost" className="w-full justify-between" />
            }
          >
            Show completed tasks
            <ChevronsUpDown className="size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1.5 rounded-2xl border p-3 text-sm text-muted-foreground">
            <p>Renew passport</p>
            <p>Pack for offsite</p>
          </CollapsibleContent>
        </Collapsible>
      </Example>
    </Group>
  );
}

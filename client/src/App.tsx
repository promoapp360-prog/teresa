import React, { Suspense, lazy } from "react";
import { Route, Switch } from "wouter";
import { ToastProvider, Spinner } from "@/components/ui";
import { SiteProvider } from "@/lib/site";
import { AuthProvider } from "@/lib/auth";
import PublicLayout from "@/pages/public/Layout";
import Home from "@/pages/public/Home";
import { AreaPage, ServicesPage, ServicePage, DoctorPage, ContactsPage, LegalPage, NotFound } from "@/pages/public/Pages";
import Booking from "@/pages/public/Booking";
import ManageBooking from "@/pages/public/ManageBooking";

const AdminApp = lazy(() => import("@/pages/admin/AdminApp"));

export default function App() {
  return (
    <ToastProvider>
      <SiteProvider>
        <Switch>
          <Route path="/admin" nest>
            <AuthProvider>
              <Suspense fallback={<Spinner />}><AdminApp /></Suspense>
            </AuthProvider>
          </Route>
          <Route>
            <PublicLayout>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/la-dottoressa" component={DoctorPage} />
                <Route path="/prestazioni" component={ServicesPage} />
                <Route path="/prestazioni/:slug">{(p) => <ServicePage slug={p.slug} />}</Route>
                <Route path="/prenota" component={Booking} />
                <Route path="/prenotazione/:token">{(p) => <ManageBooking token={p.token} />}</Route>
                <Route path="/contatti" component={ContactsPage} />
                <Route path="/privacy">{() => <LegalPage kind="privacy" />}</Route>
                <Route path="/cookie">{() => <LegalPage kind="cookie" />}</Route>
                <Route path="/:slug">{(p) => <AreaPage slug={p.slug} />}</Route>
                <Route component={NotFound} />
              </Switch>
            </PublicLayout>
          </Route>
        </Switch>
      </SiteProvider>
    </ToastProvider>
  );
}

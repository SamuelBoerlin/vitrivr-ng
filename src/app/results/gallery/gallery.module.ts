import {NgModule}      from '@angular/core';
import {FormsModule} from "@angular/forms";
import {BrowserModule} from '@angular/platform-browser';
import {GalleryComponent} from "./gallery.component";
import {AppRoutingModule} from "../../app-routing.module";
import {MaterialModule} from "../../material.module";
import {FlexLayoutModule} from "@angular/flex-layout";
import {MiniGalleryComponent} from "./mini-gallery.component";
import {ContainerPipesModule} from "../../shared/pipes/containers/container-pipes.module";
import {VbsModule} from "../../core/vbs/vbs.module";
import {InfiniteScrollModule} from "ngx-infinite-scroll";

@NgModule({
    imports:      [ MaterialModule, BrowserModule, FormsModule, AppRoutingModule, FlexLayoutModule, ContainerPipesModule, InfiniteScrollModule, VbsModule ],
    declarations: [ GalleryComponent, MiniGalleryComponent ],
    exports: [ GalleryComponent, MiniGalleryComponent ]
})
export class GalleryModule { }

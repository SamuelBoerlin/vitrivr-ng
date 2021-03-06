import {Component, Input, ViewChild} from "@angular/core";
import {TagQueryTerm} from "../../../shared/model/queries/tag-query-term.model";
import {FormControl} from "@angular/forms";
import {EMPTY, Observable} from "rxjs";
import {Tag} from "../../../shared/model/misc/tag.model";
import {TagsLookupService} from "../../../core/lookup/tags-lookup.service";
import {debounceTime, map, mergeAll, startWith} from "rxjs/operators";
import {MatAutocompleteSelectedEvent} from "@angular/material";

@Component({
    selector: 'qt-tag',
    templateUrl: 'tag-query-term.component.html',
    styleUrls: ['tag-query-term.component.css']
})
export class TagQueryTermComponent {

    /** The TagQueryTerm object associated with this TagQueryTermComponent. That object holds all the query settings. */
    @Input()
    private tagTerm: TagQueryTerm;

    /** List of tag fields  currently displayed. */
    private _field: FieldGroup;

    /** List of tag fields  currently displayed. */
    private _tags: Tag[] = [];

    /**
     * Constructor for TagQueryTermComponent
     *
     * @param {TagsLookupService} _tagService Service used to load tags from Cineast.
     */
    constructor(_tagService: TagsLookupService) {
        this._field = new FieldGroup(_tagService);
    }

    /**
     * Getter for form control.
     *
     * @return {any}
     */
    get field() {
        return this._field;
    }

    /**
     * Getter for form control.
     *
     * @return {any}
     */
    get tags() {
        return this._tags;
    }

    /**
     * Invoked whenever the user selects a Tag from the list.
     *
     * @param {MatAutocompleteSelectedEvent} event The selection event.
     */
    public onTagSelected(event: MatAutocompleteSelectedEvent) {
        for (let existing of this._tags) {
            if (existing.id == event.option.value) {
            }
        }
        this.addTag(event.option.value);
        this.field.formControl.setValue("");
        this.tagTerm.data = "data:application/json;base64," + btoa(JSON.stringify(this._tags.map(v => {return v;})));
    }

    /**
     * Add the specified tag to the list of tags.
     *
     * @param {Tag} tag The tag that should be added.
     */
    public addTag(tag: Tag) {
        this._tags.push(tag);
    }

    /**
     * Removes the specified tag from the list of tags.
     *
     * @param {Tag} tag The tag that should be removed.
     */
    public removeTag(tag: Tag) {
        let index = this._tags.indexOf(tag);
        if (index > -1) {
            this._tags.splice(index, 1);
        }
    }
}

/**
 * Groups the FormControl and the data source Observable of a specific tag field.
 */
export class FieldGroup {
    /** The FormControl used to control the tag field. */
    public readonly formControl: FormControl = new FormControl();

    /** The Observable that acts as data source for the field. */
    public readonly filteredTags: Observable<Tag[]>;

    /** The currently selected tag. */
    private _selection: Tag;

    /**
     * Constructor for FieldGroup
     *
     * @param {TagsLookupService} _tags
     */
    constructor(private _tags: TagsLookupService) {
        this.filteredTags = this.formControl.valueChanges.pipe(
            debounceTime(250),
            startWith(''),
            map((tag: string) => {
                if (tag.length >= 3) {
                    return this._tags.matching(tag)
                } else {
                    return EMPTY;
                }
            }),
            mergeAll()
        );
    }

    /**
     *
     * @return {Tag}
     */
    get selection(): Tag {
        return this._selection;
    }

    /**
     *
     * @param {Tag} value
     */
    set selection(value: Tag) {
        this._selection = value;
    }
}